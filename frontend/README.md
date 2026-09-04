# PipelineGuard

An AI agent that reads your CI/CD pipeline **configuration**, reasons about risk from history and
dependencies, and fixes what it can prove is safe to fix.

Built for the Alibaba Cloud AI Hackathon Pakistan 2026.

---

## The blind spot

Code scanners check the code. Nobody checks the assembly line that ships it.

A junior engineer widens a permission to unblock a failing deploy. No test fails. No scanner complains.
Six weeks later that scope is how an incident happens. PipelineGuard watches the pipeline definition
itself — permissions, secrets, job graph, supply chain — and explains what it finds in plain English or
Urdu.

## What makes this defensible

Three properties, each visible in the UI rather than claimed in a slide:

1. **It shows its reasoning, not a score.** Every decision is a chain of steps: what was detected, what
   history says, what the dependency graph says, what the blast radius is, how confidence aggregated, and
   why the decision followed. Every citation links to the artefact it came from.
2. **Confidence moves in both directions.** The confidence trajectory on each investigation has nodes that
   go *down* — steps where the agent found evidence against its own working hypothesis. A line that only
   rises is a scoring function; a line that dips is judgement.
3. **It can refuse.** Below the recommendation floor, or when two hypotheses sit within 15 points, the
   agent publishes no fix and no risk score. It escalates the one question that would resolve the matter.

## The three outcomes

`/demo` runs all three in sequence, in under three minutes.

| Outcome | Scenario | Confidence | Why |
| --- | --- | --- | --- |
| **Auto-fixed** | Actions pinned to mutable tags | 96% | Deterministic remedy, blast radius excludes production and secrets, behaviour verified against a previous green run |
| **Flagged** | `permissions: write-all` on a production deploy | 71% | Fix written and deliberately withheld — one runtime value decides whether the patch breaks production |
| **Refused** | Unresolvable outbound POST in `release.yml` | 38% | Two readings 11 points apart; drafting a fix would mean assuming intent |

A tool that always says yes proves less than one that knows when not to.

---

## Integration contract

The live dashboard consumes Archive A's FastAPI response through
[`src/lib/contract/backend-adapt.ts`](src/lib/contract/backend-adapt.ts). The older
[`src/lib/contract/adapt.ts`](src/lib/contract/adapt.ts) and contract fixtures remain isolated to the
recorded replay experience.

```ts
risk_score: { risk_score, confidence, reasons[], affected_jobs[], graph_path[], model_breakdown{} }
agent:      { action, confidence, fix_diff, verification{}, explanation_en, explanation_ur,
              escalation_reason, pr_url }
```

**When the backend shape changes, only `backend-adapt.ts` and the centralized API client need to
change.** The live Analyze screen does not recreate agent decisions.

What the adapter guarantees:

- **It never throws.** A malformed payload during judging degrades the UI; it does not crash it.
- **It never invents.** Missing confidence, explanations, fixes, verification, model evidence, or PR
  URLs stay missing.
- **It reports gaps.** Available and missing evidence are shown directly on `/analyze`, including
  explicit Detection Core unavailable and invalid-response states.
- **It converts scores only with a declared scale.** Archive A's `0-1` Detection Core score is
  displayed as `0-100`; unknown scales are not silently interpreted.

Open questions for teammates are marked `❓` inline in `types.ts`. The most valuable one: if the
Agentic Layer can emit a per-step `reasoning_log`, the reasoning view renders the agent's real trace
instead of synthesising steps from the risk payload.

Contract-shaped fixtures live in [`src/lib/mock/contract-runs.ts`](src/lib/mock/contract-runs.ts) and
are served only by the explicitly selected replay/mock path.

## Adding a repository to test

Go to **`/analyze`**, enter `owner/repo`, press Analyze.

That screen is the live path: it calls the FastAPI gateway's `/api/v1/analyze`, which reads the
workflow from GitHub, calls Detection Core, applies the authoritative agentic boundary, and persists
the resulting assessment. Public repositories need no credentials.

For a private repository, either set a token in `.env.local`:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

or paste one into the token field on `/analyze`. It is used for that request only and is never stored,
logged, or sent anywhere except `api.github.com`.

### What it detects

| Rule | Catches |
| --- | --- |
| `PERM.WRITE_ALL_ROOT` | `permissions: write-all` at workflow root |
| `PERM.BROAD_WRITE` | A job holding three or more write scopes |
| `SUP.ACTION_MUTABLE_REF` | Third-party actions pinned by tag instead of commit SHA |
| `SEC.SECRET_IN_LOGGED_ENV` | A secret in the environment of a job that also dumps the environment |
| `EXP.UNRESOLVED_EGRESS` | Outbound requests to a destination the agent cannot resolve |
| `POL.PR_TARGET_CHECKOUT` | `pull_request_target` checking out untrusted PR code |
| `INT.ARTIFACT_NO_CHECKSUM` | Cross-job artifacts consumed without an integrity check |
| `SUP.CURL_PIPE_SHELL` | A remote script piped straight into a shell |

### Sample workflows

This repository ships three sample workflows under `.github/workflows/sample-*.yml` that exercise all
three outcomes when you analyse it. They are inert by construction: `workflow_dispatch` is the only
trigger, every step is an `echo`, and the network call is commented out. Delete them to remove.

Scanning this repository produces roughly:

```
auto-fixed: 8   flagged: 4   refused: 1
```

Note one detail worth demonstrating: a `checkout@v4` finding reaches 96% confidence and is still
**flagged rather than auto-fixed**, because it sits in the production-bound workflow. Same evidence,
same confidence, different decision — the policy overrides the number.

### What is real, and what is not

Real: `/analyze` — the browser calls Archive A's FastAPI gateway and renders its observable response.

Fixtures: the bundled replay path and mock gateway remain available for the showcase screens. The
frontend does not treat those fixtures as live Detection Core output.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000 after starting the FastAPI gateway on port 8000. Set
`NEXT_PUBLIC_API_BASE` when the gateway is deployed elsewhere.

Other commands:

```bash
npm run build
```

```bash
npm run typecheck
```

## Architecture

```
src/
  app/
    (auth)/          login, signup, password reset, email verification
    (onboarding)/    organisation, connect providers, autonomy setup
    (app)/           the product — 30 screens behind one shell
    api/v1/          explicitly selected mock GET gateway for showcase/replay
  components/
    reasoning/       the reasoning chain and confidence trajectory
    fixes/           diff viewer, "what this prevents", validation
    graph/           dependency graph and blast-radius tracing
    charts/          Recharts wrappers bound to design tokens
    ui/              primitives
    shell/           sidebar, header, source pill
  lib/
    design/tokens.ts Untitled UI Pro tokens, extracted from Figma
    mock/            scenarios, fixes, findings, trends, patterns
    replay/          the cassette
    api/             centralized client + polling hooks
    contract/        live backend adapter plus replay contract adapter
    types.ts         the UI domain model
```

### Swapping in the real gateway

The live backend boundary is `src/lib/api/client.ts` plus
`src/lib/contract/backend-adapt.ts`. Set:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

Live analysis uses `apiPost('analyze', ...)`; polling screens use the same client's `apiGet`. The
browser no longer imports or calls the old local repository analyzer.

### Replay mode

The brief asked for a fallback that is indistinguishable from live. That is achieved by construction, not
imitation:

- **Same payloads** — cassette and gateway build responses from the same source, so they cannot drift.
- **Same latency** — latency is a pure function of the request path, byte-identical in both
  (`latencyFor()` appears in `route.ts` and `cassette.ts`). Replay does not return instantly and does not
  fake a random delay; it returns in the same number of milliseconds.
- **Explicitly isolated** — `/live` only loads the contract cassette in Replay mode; Live mode points
  to `/analyze` so demo fixtures cannot masquerade as backend results.
- **Same step timing** — reasoning chains animate from each step's recorded duration.
- **Bundled, not fetched** — the cassette ships in the JS bundle and works with the network unplugged.

Toggle from the header pill, from `/replay`, or force it at boot with `NEXT_PUBLIC_REPLAY=1`.
The header pill is the only tell, and that is deliberate — hiding the mode from the operator would be the
wrong kind of seamless.

## Design system

The palette, spacing, radius and type scales are extracted directly from the
[Untitled UI – Pro](https://www.figma.com/design/vqd5Jli9nCyTELlPd0Vjx9/Untitled-UI---Pro) Figma library:

- `src/lib/design/tokens.ts` — primitive ramps, spacing, radius, type scale
- `src/app/globals.css` — 108 semantic colour tokens as CSS variables, light and dark
- `tailwind.config.ts` — a thin mapping so `bg-secondary` in code is the token a designer sees in Figma

Theming is a CSS-variable swap. Nothing in the app hardcodes a hex value.

**One product extension** the generic library has no concept of: what the agent *decided*. Auto-fix is
green, flagged is amber, and refused deliberately gets **no hue at all** — neutral ink and a dashed
border. A refusal is not a failure and not a success; colouring it red would teach the wrong lesson to
whoever reads the dashboard.

## Bilingual output

The agent's reasoning is bilingual — every claim, supporting bullet, decision rationale, fix rationale and
"what this prevents" line exists in English and Urdu. Switch with the header toggle.

Direction is resolved per text block via `dir="auto"`, so Urdu content lays out right-to-left inside an
otherwise left-to-right English tool shell without either corrupting the other.

**Scope note:** agent-generated content is translated. Static UI chrome (nav labels, column headers,
panel titles) is English-only.

## Status

**Working:** all 41 routes, the mock gateway, replay, both themes, both languages, the three-outcome demo.

**Not built yet:**

- Authentication is UI-only — the forms navigate, they do not authenticate. Supabase slots in behind
  `(auth)/` without changing the forms.
- Data is fixture data in `src/lib/mock/`. It is internally consistent (findings, investigations, fixes,
  runs, graph and trends all reference each other) but it is not live.
- Mutations are not wired. Approve/reject buttons in the review queue are presentational.
- The dependency graph reads server-computed `column`/`row` coordinates; there is no layout algorithm.

## Demo runbook

See [`DEMO.md`](./DEMO.md).
