"""Standalone lazy Hugging Face detector for PipelineGuard Detection Core."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from math import isfinite
from threading import Lock
from typing import Any


class DetectionError(RuntimeError):
    """Raised when model loading or inference cannot produce a result."""


Loader = Callable[[str], tuple[Any, Any, Any]]


class HuggingFaceDetector:
    """Load the model once per process and classify workflow text on CPU."""

    _SUPPORTED_PADDING = {"max_length", "longest", "do_not_pad"}

    def __init__(
        self,
        *,
        model_id: str,
        input_mode: str = "workflow_text",
        max_length: int = 512,
        padding: str = "max_length",
        truncation: bool = True,
        clean_max_risk: float = 0.20,
        malicious_min_risk: float = 0.80,
        loader: Loader | None = None,
    ) -> None:
        self.model_id = model_id
        self.input_mode = input_mode
        self.max_length = max_length
        self.padding = padding
        self.truncation = truncation
        self.clean_max_risk = clean_max_risk
        self.malicious_min_risk = malicious_min_risk
        self._loader = loader or self._load_components
        self._tokenizer: Any | None = None
        self._model: Any | None = None
        self._torch: Any | None = None
        self._load_lock = Lock()
        self._validate_configuration()

    def _validate_configuration(self) -> None:
        if self.input_mode != "workflow_text":
            raise ValueError("MODEL_INPUT_MODE must be 'workflow_text'")
        if not isinstance(self.max_length, int) or isinstance(self.max_length, bool):
            raise ValueError("MODEL_MAX_LENGTH must be an integer")
        if self.max_length <= 0:
            raise ValueError("MODEL_MAX_LENGTH must be positive")
        if self.padding not in self._SUPPORTED_PADDING:
            raise ValueError(
                "MODEL_PADDING must be max_length, longest, or do_not_pad"
            )
        if not isinstance(self.truncation, bool):
            raise ValueError("MODEL_TRUNCATION must be a boolean")
        if not self._valid_probability(self.clean_max_risk):
            raise ValueError("CLEAN_MAX_RISK must be between 0 and 1")
        if not self._valid_probability(self.malicious_min_risk):
            raise ValueError("MALICIOUS_MIN_RISK must be between 0 and 1")
        if self.clean_max_risk >= self.malicious_min_risk:
            raise ValueError(
                "CLEAN_MAX_RISK must be lower than MALICIOUS_MIN_RISK"
            )

    @staticmethod
    def _valid_probability(value: Any) -> bool:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return False
        return isfinite(number) and 0.0 <= number <= 1.0

    @staticmethod
    def _load_components(model_id: str) -> tuple[Any, Any, Any]:
        try:
            import torch
            from transformers import AutoTokenizer, RobertaForSequenceClassification
        except ImportError as error:
            raise DetectionError(
                "torch and transformers are required for local inference"
            ) from error

        try:
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = RobertaForSequenceClassification.from_pretrained(model_id)
        except Exception as error:
            raise DetectionError(f"Unable to load model '{model_id}'") from error
        return tokenizer, model, torch

    def _components(self) -> tuple[Any, Any, Any]:
        if self._tokenizer is None or self._model is None or self._torch is None:
            with self._load_lock:
                if (
                    self._tokenizer is None
                    or self._model is None
                    or self._torch is None
                ):
                    try:
                        tokenizer, model, torch = self._loader(self.model_id)
                        model.to("cpu")
                        model.eval()
                    except DetectionError:
                        raise
                    except Exception as error:
                        raise DetectionError(
                            f"Unable to prepare model '{self.model_id}' for CPU inference"
                        ) from error
                    self._tokenizer = tokenizer
                    self._model = model
                    self._torch = torch
        return self._tokenizer, self._model, self._torch

    @staticmethod
    def _move_inputs_to_cpu(inputs: Mapping[str, Any]) -> dict[str, Any]:
        return {
            key: value.to("cpu") if hasattr(value, "to") else value
            for key, value in inputs.items()
        }

    def _status_for_probability(self, risk_probability: float) -> str:
        if risk_probability < self.clean_max_risk:
            return "clean"
        if risk_probability < self.malicious_min_risk:
            return "suspicious"
        return "malicious"

    def detect(self, workflow_text: str) -> dict[str, str | float]:
        if not isinstance(workflow_text, str) or not workflow_text.strip():
            raise DetectionError("workflow content must not be empty")

        tokenizer, model, torch = self._components()
        normalized_text = workflow_text.replace("\r\n", "\n").replace("\r", "\n")

        try:
            inputs = tokenizer(
                normalized_text,
                max_length=self.max_length,
                padding=self.padding,
                truncation=self.truncation,
                return_tensors="pt",
            )
            inputs = self._move_inputs_to_cpu(inputs)
            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits
                shape = getattr(logits, "shape", ())
                if len(shape) != 2 or shape[0] < 1 or shape[1] < 2:
                    raise DetectionError(
                        "model logits must have shape [batch, at least 2 classes]"
                    )
                if not bool(torch.isfinite(logits).all()):
                    raise DetectionError("model logits were not finite")
                probabilities = torch.softmax(logits, dim=-1)
                risky_value = probabilities[0, 1]
                risky_probability = float(
                    risky_value.detach().cpu().item()
                    if hasattr(risky_value, "detach")
                    else risky_value.item()
                )
        except DetectionError:
            raise
        except Exception as error:
            raise DetectionError("local model inference failed") from error

        if not self._valid_probability(risky_probability):
            raise DetectionError("model risky probability was not finite or 0–1")

        return {
            "status": self._status_for_probability(risky_probability),
            "risk_score": risky_probability,
        }