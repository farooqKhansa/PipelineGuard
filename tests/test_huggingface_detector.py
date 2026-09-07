import asyncio
import math
import sys
import types

import pytest

from app.services import detection_service
from app.services.detection_contract import LOCAL_HUGGINGFACE_SOURCE
from app.services.huggingface_detector import (
    HuggingFaceDetectionError,
    HuggingFaceDetector,
)


class FakeTensor:
    def __init__(self, value, shape=None):
        self.value = value
        self.shape = shape
        self.detach_called = False

    def to(self, device):
        return self

    def detach(self):
        self.detach_called = True
        return self

    def cpu(self):
        return self

    def item(self):
        return self.value


class FakeLogits:
    def __init__(self, values):
        self.values = values
        self.shape = (len(values), len(values[0]))


class FakeTorch:
    def __init__(self, logits, probabilities):
        self.logits = logits
        self.probabilities = probabilities
        self.no_grad_entered = False
        self.softmax_args = None

    class _NoGrad:
        def __init__(self, owner):
            self.owner = owner

        def __enter__(self):
            self.owner.no_grad_entered = True

        def __exit__(self, exc_type, exc, traceback):
            return False

    def no_grad(self):
        return self._NoGrad(self)

    def isfinite(self, logits):
        return FakeFiniteResult(
            all(math.isfinite(value) for row in logits.values for value in row)
        )

    def softmax(self, logits, dim):
        self.softmax_args = (logits, dim)
        return self.probabilities


class FakeFiniteResult:
    def __init__(self, value):
        self.value = value

    def all(self):
        return self.value


class FakeTokenizer:
    def __init__(self):
        self.calls = []

    def __call__(self, text, **kwargs):
        self.calls.append((text, kwargs))
        return {"input_ids": FakeTensor([1, 2])}


class FakeModel:
    def __init__(self, logits):
        self.logits = logits
        self.eval_called = False
        self.to_device = None

    def __call__(self, **inputs):
        return types.SimpleNamespace(logits=self.logits)

    def eval(self):
        self.eval_called = True
        return self

    def to(self, device):
        self.to_device = device
        return self


def make_loader(probability=0.91, logits=None):
    tokenizer = FakeTokenizer()
    model = FakeModel(logits or FakeLogits([[0.0, 1.0]]))
    torch = FakeTorch(
        model.logits,
        FakeProbability(probability),
    )

    def loader(model_id):
        return tokenizer, model, torch

    return loader, tokenizer, model, torch


class FakeProbability:
    def __init__(self, value):
        self.value = value

    def __getitem__(self, index):
        return FakeTensor(self.value)


def make_detector(**kwargs):
    loader, tokenizer, model, torch = make_loader()
    detector = HuggingFaceDetector(loader=loader, **kwargs)
    return detector, tokenizer, model, torch


def test_model_loading_is_lazy_and_happens_once():
    calls = []
    loader, tokenizer, model, torch = make_loader()

    def counting_loader(model_id):
        calls.append(model_id)
        return loader(model_id)

    detector = HuggingFaceDetector(
        model_id="test/model",
        loader=counting_loader,
    )

    assert calls == []
    detector.detect("name: CI")
    detector.detect("name: CI")
    assert calls == ["test/model"]


def test_tokenizer_receives_explicit_configuration_and_normalized_text():
    detector, tokenizer, _, _ = make_detector(
        model_id="test/model",
        max_length=256,
        padding="max_length",
        truncation=True,
    )

    detector.detect("name: CI\r\njobs:\rbuild:\n")

    text, options = tokenizer.calls[0]
    assert text == "name: CI\njobs:\nbuild:\n"
    assert options == {
        "max_length": 256,
        "padding": "max_length",
        "truncation": True,
        "return_tensors": "pt",
    }


def test_inference_uses_no_grad_and_class_index_one():
    detector, _, _, torch = make_detector(model_id="test/model")

    result = detector.detect("name: CI")

    assert torch.no_grad_entered is True
    assert torch.softmax_args[1] == -1
    assert result == {"status": "malicious", "risk_score": 0.91}


@pytest.mark.parametrize(
    ("probability", "expected"),
    [
        (0.199999, "clean"),
        (0.20, "suspicious"),
        (0.799999, "suspicious"),
        (0.80, "malicious"),
    ],
)
def test_status_threshold_boundaries(probability, expected):
    loader, tokenizer, model, torch = make_loader(probability=probability)
    detector = HuggingFaceDetector(
        model_id="test/model",
        clean_max_risk=0.20,
        malicious_min_risk=0.80,
        loader=loader,
    )
    result = detector.detect("name: CI")

    assert result["status"] == expected
    assert result["risk_score"] == probability


@pytest.mark.parametrize(
    ("clean", "malicious"),
    [
        (-0.1, 0.8),
        (0.2, 1.1),
        (0.8, 0.2),
        (float("nan"), 0.8),
        (0.2, float("inf")),
    ],
)
def test_invalid_thresholds_are_rejected(clean, malicious):
    loader, _, _, _ = make_loader()

    with pytest.raises(ValueError):
        HuggingFaceDetector(
            model_id="test/model",
            clean_max_risk=clean,
            malicious_min_risk=malicious,
            loader=loader,
        )


def test_empty_input_is_rejected_without_loading_model():
    calls = []

    def loader(model_id):
        calls.append(model_id)
        return make_loader()[0](model_id)

    detector = HuggingFaceDetector(model_id="test/model", loader=loader)

    with pytest.raises(HuggingFaceDetectionError):
        detector.detect(" \n\t")
    assert calls == []


@pytest.mark.parametrize(
    "logits",
    [
        FakeLogits([[1.0]]),
        FakeLogits([[float("nan"), 1.0]]),
        FakeLogits([[float("inf"), 1.0]]),
    ],
)
def test_invalid_logits_are_rejected(logits):
    loader, _, _, _ = make_loader(logits=logits)
    detector = HuggingFaceDetector(model_id="test/model", loader=loader)

    with pytest.raises(HuggingFaceDetectionError):
        detector.detect("name: CI")


@pytest.mark.parametrize("probability", [float("nan"), float("inf"), -0.1, 1.1])
def test_invalid_probabilities_are_rejected(probability):
    loader, _, _, _ = make_loader(probability=probability)
    detector = HuggingFaceDetector(model_id="test/model", loader=loader)

    with pytest.raises(HuggingFaceDetectionError):
        detector.detect("name: CI")


def test_model_loading_failure_is_explicit():
    def loader(model_id):
        raise HuggingFaceDetectionError("checkpoint unavailable")

    detector = HuggingFaceDetector(model_id="test/model", loader=loader)

    with pytest.raises(HuggingFaceDetectionError, match="checkpoint unavailable"):
        detector.detect("name: CI")


def test_inference_failure_is_explicit():
    class BrokenModel(FakeModel):
        def __call__(self, **inputs):
            raise RuntimeError("broken inference")

    tokenizer = FakeTokenizer()
    model = BrokenModel(FakeLogits([[0.0, 1.0]]))
    torch = FakeTorch(model.logits, FakeProbability(0.5))
    detector = HuggingFaceDetector(
        model_id="test/model",
        loader=lambda model_id: (tokenizer, model, torch),
    )

    with pytest.raises(HuggingFaceDetectionError, match="inference failed"):
        detector.detect("name: CI")


def test_local_service_returns_unavailable_without_demo_fallback(monkeypatch):
    monkeypatch.setattr(detection_service.settings, "DETECTION_PROVIDER", "local_huggingface")
    monkeypatch.setattr(
        detection_service,
        "_get_local_detector",
        lambda: (_ for _ in ()).throw(
            HuggingFaceDetectionError("checkpoint unavailable")
        ),
    )

    payload, used_fallback = asyncio.run(
        detection_service.analyze(
            "acme/repo",
            "local-run",
            diff="name: CI",
            allow_demo_fallback=True,
        )
    )

    assert used_fallback is False
    assert payload["source"] == LOCAL_HUGGINGFACE_SOURCE
    assert payload["detection_status"] == "unavailable"
    assert "risk_score" not in payload


def test_local_provider_preserves_detection_contract(monkeypatch):
    class Detector:
        def detect(self, workflow_text):
            return {"status": "suspicious", "risk_score": 0.42}

    monkeypatch.setattr(detection_service.settings, "DETECTION_PROVIDER", "local_huggingface")
    monkeypatch.setattr(detection_service, "_get_local_detector", lambda: Detector())

    payload, used_fallback = asyncio.run(
        detection_service.analyze(
            "acme/repo",
            "local-run",
            diff="name: CI",
            allow_demo_fallback=False,
        )
    )

    assert used_fallback is False
    assert payload["source"] == LOCAL_HUGGINGFACE_SOURCE
    assert payload["risk_score"] == 0.42
    assert payload["detection_status"] == "complete_for_detection"