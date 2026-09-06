# PipelineGuard Model Integration Policy

This document describes the local integration of
`FaizaML/pipelineguard-codebert-risk`. It separates facts established by the
model repository from decisions made by PipelineGuard to create a safe,
replaceable Detection Core boundary.

## Verified Model Facts

- The model architecture is `RobertaForSequenceClassification`.
- Label `0` is `benign`.
- Label `1` is `risky`.
- The tokenizer is `RobertaTokenizer`.
- The config-consistent risky probability is
  `softmax(logits, dim=-1)[0, 1]`.
- The tokenizer configuration advertises a maximum length of `512`.

## Unknown Original Training Behavior

The available model repository does not establish:

- The original training input representation.
- Whether training used workflow YAML, another code representation, or
  additional context.
- Whether training used 256 or 512 tokens.
- Training-time padding, truncation, or normalization.
- Validated probability thresholds or calibration.
- A mapping from `benign/risky` to PipelineGuard's three statuses.

None of those behaviors are claimed to have been recovered.

## PipelineGuard Integration Policy

The local provider is opt-in through:

```text
DETECTION_PROVIDER=local_huggingface
```

The default remains `external`, which preserves the existing
`POST {DETECTION_CORE_URL}/detect` path. Local model failures do not activate
demo fallback.

The provider returns only model-derived Detection Core evidence:

```json
{
  "status": "clean | suspicious | malicious",
  "risk_score": 0.0
}
```

It does not fabricate confidence, reasons, affected jobs, graph paths,
model breakdowns, diffs, or remediation evidence.

## Input Policy

The default input mode is `workflow_text`. The decoded workflow content is
passed to the tokenizer as plain text. Repository names and workflow run IDs
are not injected into the model input.

PipelineGuard normalizes CRLF and CR line endings to LF while preserving the
workflow's content, ordering, comments, and indentation otherwise. This is an
engineering integration decision, not recovered training behavior.

## Tokenization Policy

The following values are explicit and configurable:

```text
DETECTION_MODEL_MAX_LENGTH=512
DETECTION_MODEL_PADDING=max_length
DETECTION_MODEL_TRUNCATION=true
```

The default `512` value follows the tokenizer configuration's advertised
maximum; it does not establish the model's training-time sequence length.
Right-side truncation is used by the tokenizer default. Empty workflow input
is rejected.

## Risk Probability Calculation

The detector runs CPU-safe inference under `torch.no_grad()` and computes:

```python
risk_probability = softmax(logits, dim=-1)[0, 1]
```

The probability must be finite and within `0–1`. It becomes the contract's
`risk_score` without rescaling.

## Three-State Status Policy

The binary model probability is mapped using configurable thresholds:

```text
risk < DETECTION_CLEAN_MAX_RISK
    → clean

DETECTION_CLEAN_MAX_RISK ≤ risk < DETECTION_MALICIOUS_MIN_RISK
    → suspicious

risk ≥ DETECTION_MALICIOUS_MIN_RISK
    → malicious
```

Defaults:

```text
DETECTION_CLEAN_MAX_RISK=0.20
DETECTION_MALICIOUS_MIN_RISK=0.80
```

These are conservative PipelineGuard engineering thresholds. They are not
claimed to be trained, calibrated, validated, or recovered model thresholds.
The boundaries are validated so the clean threshold must be below the
malicious threshold.

## Failure Policy

Model loading failures, missing local dependencies, empty input, invalid
logits, non-finite probabilities, and inference failures produce an explicit
Detection Core `unavailable` result without a score. They are logged without
exposing a fabricated prediction.

Local results still pass through the existing Detection Core contract,
canonical assessment adapter, authoritative Workstream 2 boundary, and
persistence flow. Missing canonical evidence remains incomplete.

## How To Replace These Assumptions Later

If the original training code, preprocessing, calibration data, or inference
service becomes available:

1. Verify the recovered input representation and preprocessing.
2. Replace the local provider's input policy and tokenizer settings.
3. Recalibrate or replace the status thresholds using documented evidence.
4. Update the focused tests and this policy document.
5. Preserve the `status` / `risk_score` Detection Core contract.
6. Keep the canonical assessment and authoritative Workstream 2 boundary
   unchanged unless a separately approved policy milestone changes them.