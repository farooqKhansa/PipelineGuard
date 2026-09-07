---
name: Verification environment
description: Environment constraints encountered while verifying the PipelineGuard backend and migrated Vite frontend.
---

Backend verification runs on Python 3.13 in this workspace. The older pinned psycopg2-binary and safetensors requirements do not resolve cleanly there; current compatible packages are sufficient for the SQLite-backed test suite because the detector loads its ML dependencies lazily.

**Why:** A verification attempt that installs the original pins can fail before tests start, even though the application and tests themselves are compatible.

**How to apply:** Use the workspace's compatible Python package environment for backend tests, and provide the artifact's configured PORT and BASE_PATH values when invoking the Vite build outside its managed workflow.