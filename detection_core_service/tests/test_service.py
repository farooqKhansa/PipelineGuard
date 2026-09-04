import math
import types

import pytest
from fastapi.testclient import TestClient

from detection_core_service.app.detector import DetectionError, HuggingFaceDetector
from detection_core_service.app.main import app, get_detector


class FakeTensor:
    def __init__(self, value):
        self.value = value

    def to(self, device):
        return self

    def detach(self):
        return self

    def cpu(self):
        return self

    def item(self):
        return self.value


class FakeLogits:
    shape = (1, 2)


class FakeProbability:
    def __init__(self, value):
        self.value = value

    def __getitem__(self, index):
        return FakeTensor(self.value)


class FakeTorch:
    def __init__(self, probability):
        self.probability = probability
        self.no_grad_used = False

    class NoGrad:
        def __init__(self, owner):
            self.owner = owner

        def __enter__(self):
            self.owner.no_grad_used = True

        def __exit__(self, exc_type, exc, traceback):
            return False

    def no_grad(self):
        return self.NoGrad(self)

    def isfinite(self, logits):
        return types.SimpleNamespace(all=lambda: True)

    def softmax(self, logits, dim):
        assert dim == -1
        return FakeProbability(self.probability)


class FakeTokenizer:
    def __init__(self):
        self.calls = []

    def __call__(self, text, **kwargs):
        self.calls.append((text, kwargs))
        return {"input_ids": FakeTensor([1, 2])}


class FakeModel:
    def __init__(self):
        self.eval_called = False
        self.device = None

    def to(self, device):
        self.device = device
        return self

    def eval(self):
        self.eval_called = True
        return self

    def __call__(self, **inputs):
        return types.SimpleNamespace(logits=FakeLogits())


def fake_loader(probability=0.42):
    tokenizer = FakeTokenizer()
    model = FakeModel()
    torch = FakeTorch(probability)
    return lambda model_id: (tokenizer, model, torch), tokenizer, model, torch


def test_request_validation_rejects_empty_diff():
    response = TestClient(app).post(
        "/detect",
        json={"repo": "a/b", "workflow_run_id": "1", "diff": " \n"},
    )
    assert response.status_code == 422


def test_successful_response_preserves_contract(monkeypatch):
    loader, _, _, _ = fake_loader(0.42)
    detector = HuggingFaceDetector(model_id="test/model", loader=loader)
    app.dependency_overrides.clear()
    monkeypatch.setattr(
        "detection_core_service.app.main.get_detector",
        lambda: detector,
    )

    response = TestClient(app).post(
        "/detect",
        json={"repo": "a/b", "workflow_run_id": "1", "diff": "name: CI"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "suspicious", "risk_score": 0.42}


def test_softmax_risky_probability_and_tokenizer_policy():
    loader, tokenizer, model, torch = fake_loader(0.91)
    detector = HuggingFaceDetector(
        model_id="test/model",
        max_length=256,
        padding="max_length",
        truncation=True,
        loader=loader,
    )

    result = detector.detect("name: CI\r\njobs:\n")

    assert result == {"status": "malicious", "risk_score": 0.91}
    assert torch.no_grad_used is True
    assert tokenizer.calls[0][0] == "name: CI\njobs:\n"
    assert tokenizer.calls[0][1]["max_length"] == 256
    assert tokenizer.calls[0][1]["padding"] == "max_length"
    assert tokenizer.calls[0][1]["truncation"] is True
    assert model.device == "cpu"
    assert model.eval_called is True


@pytest.mark.parametrize(
    ("probability", "status"),
    [
        (0.199999, "clean"),
        (0.20, "suspicious"),
        (0.799999, "suspicious"),
        (0.80, "malicious"),
    ],
)
def test_threshold_boundaries(probability, status):
    loader, _, _, _ = fake_loader(probability)
    detector = HuggingFaceDetector(model_id="test/model", loader=loader)
    assert detector.detect("name: CI")["status"] == status


@pytest.mark.parametrize(
    ("clean", "malicious"),
    [(-0.1, 0.8), (0.2, 1.1), (0.8, 0.2), (math.nan, 0.8)],
)
def test_invalid_thresholds_are_rejected(clean, malicious):
    loader, _, _, _ = fake_loader()
    with pytest.raises(ValueError):
        HuggingFaceDetector(
            model_id="test/model",
            clean_max_risk=clean,
            malicious_min_risk=malicious,
            loader=loader,
        )


def test_empty_input_rejected_before_model_load():
    calls = []

    def loader(model_id):
        calls.append(model_id)
        return fake_loader()[0](model_id)

    detector = HuggingFaceDetector(model_id="test/model", loader=loader)
    with pytest.raises(DetectionError):
        detector.detect(" \t")
    assert calls == []


def test_invalid_and_non_finite_output_is_rejected():
    class InvalidTorch(FakeTorch):
        def isfinite(self, logits):
            return types.SimpleNamespace(all=lambda: False)

    tokenizer = FakeTokenizer()
    model = FakeModel()
    torch = InvalidTorch(float("nan"))
    detector = HuggingFaceDetector(
        model_id="test/model",
        loader=lambda model_id: (tokenizer, model, torch),
    )

    with pytest.raises(DetectionError):
        detector.detect("name: CI")


def test_loading_and_inference_failures_are_http_failures(monkeypatch):
    def failing_detector():
        raise DetectionError("checkpoint unavailable")

    monkeypatch.setattr(
        "detection_core_service.app.main.get_detector",
        failing_detector,
    )
    response = TestClient(app).post(
        "/detect",
        json={"repo": "a/b", "workflow_run_id": "1", "diff": "name: CI"},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"]["error"] == "detection_unavailable"
    assert "risk_score" not in body