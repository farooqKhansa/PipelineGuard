# PipelineGuard — 3-minute live demo script

Literal script. Left column is what you do, right is what you say. Total 3:00.

The whole demo runs on **one screen** (`/live`) using the run selector, so the three
outcomes read as one agent behaving differently — not three separate demos.

---

## Pre-flight (do this 2 minutes before you present)

1. `npm run build && npm start` — use the production build, not `npm run dev`.
   Dev mode double-invokes effects and is slower.
2. Open `http://localhost:3000/live`.
3. Check the header pill reads **Live** with a latency figure.
4. Click **#4471** so you start on the auto-fix run, stage rail idle.
5. Dark mode on. Browser at 100% zoom. Close the sidebar on a small screen.
6. Open a second tab on `/replay` — your escape hatch.

**One-line fallback rule:** if anything stalls, click the header pill. Do not
announce it. Data and timing are identical.

---

## 0:00 – 0:20 — Frame the problem

**Do:** Stay on `/live`, idle state. Don't click yet.

> "Every security tool you know checks the code. Nobody checks the assembly line
> that ships it. A junior engineer widens one permission to unblock a failing
> deploy — no test fails, no scanner complains, and six weeks later that's your
> incident. PipelineGuard watches the pipeline itself."

---

## 0:20 – 1:05 — Act one: it acts

**Do (0:20):** Click **Run analysis**.

**Appears:** Stage rail advances. `Queued` → `Analyzing` with a scan line moving
down a workflow skeleton → `Risk detected`.

> "This is a real run. The Detection Core is reading the workflow and the run
> history right now."

**Do (0:32):** Let `Risk detected` land. Point at the score.

**Appears:** Risk score counts up to **34 / 100**, band label **Low** in green.
Contributing signals list in with weights. Propagation path animates: `test →
coverage-report → build → npm-registry`.

> "Thirty-four. And notice it's green — this tool reports a measurement, it isn't
> a fire alarm. But watch the propagation path: the risky step is in `test`, which
> has read-only permissions. Two hops later it reaches `build`, which can publish
> packages. That's the connection a per-file scanner cannot see."

**Do (0:50):** Let it run to `Decision`.

**Appears:** Radial gauge sweeps to **96%**, green, pill reads `auto-fix`. The
"What this prevents" panel appears on the right.

> "Ninety-six percent. The two notches on that dial are the decision floors —
> forty-five to recommend anything, ninety to act without a human. It cleared both,
> so it acted."

**Do (1:00):** Point at the green panel, *not* the diff.

> "'Prevents an upstream maintainer silently repointing the v3 tag to different
> code that then runs inside your build.' That sentence is the product. The diff
> is just the evidence."

---

## 1:05 – 1:55 — Act two: it holds back

**Do (1:05):** Click **#4472** in the run selector, then **Run analysis**.

**Appears:** Same four stages. Risk counts up to **88 / 100**, band **Severe**.

> "Same agent, different run. Eighty-eight — `permissions: write-all` on a
> production deploy."

**Do (1:20):** Let `Agent deciding` land. Point at the model bars.

**Appears:** Three model bars fill: gradient_boost 84, rule_engine 95,
anomaly_detector 61.

> "Three models, and they don't fully agree. The dashboard shows you that instead
> of hiding it behind one number."

**Do (1:32):** Let it reach `Decision`.

**Appears:** Gauge sweeps to **71%**, amber, pill reads `propose w/ caution`.

> "Seventy-one. Above the recommend floor, below the auto-fix floor — so it
> stopped."

**Do (1:42):** Scroll to the validation panel. Point at the one **failed** check.

> "It wrote the fix. It validated it against thirty replayed runs. And one check
> failed: a step builds a `gh api` subcommand at runtime, so it cannot prove the
> narrowed permissions are sufficient. Applying it might break the production
> deploy — which is worse than the risk it removes. So it refused to merge its own
> fix and asked one question: what values can `RELEASE_MODE` take?"

---

## 1:55 – 2:40 — Act three: it refuses

**Do (1:55):** Click **#4473**, then **Run analysis**.

**Appears:** Risk **61 / 100**. Model bars disagree sharply — 44 / 81 / 29.

> "Sixty-one, and now look at the models — forty-four, eighty-one, twenty-nine.
> They fundamentally disagree."

**Do (2:12):** Let it reach `Decision`.

**Appears:** Gauge sweeps to **38%**, neutral grey, pill reads `escalate`. Right
panel says **No fix was drafted**. No diff anywhere on screen.

> "Thirty-eight percent — below the floor. So there is no fix, no pull request,
> and deliberately no risk score published."

**Do (2:25):** Point at the explanation panel.

> "A job posts your entire GitHub event — including every committer's email — to a
> URL stored in an org variable the agent isn't allowed to read. If that host is
> internal, this is a routine webhook and the right action is nothing. If it's
> external, you're leaking identities on every release. Both readings fit the same
> evidence. It could have averaged them into a number — that number would describe
> neither. So it escalated a question instead of publishing a guess."

---

## 2:40 – 3:00 — Close

**Do:** Click **اردو** in the header. The explanation flips to Urdu in place.

> "Same reasoning, in Urdu — the claims and the evidence, not just the labels. A
> junior engineer reads the argument, not a red error code."

**Do:** Click back to **EN**.

> "Confident action. Deliberate restraint. Honest uncertainty. One agent, three
> answers — and the third one is the reason you could trust it with write access."

---

## Fallback drill — rehearse this once

**Simulating the failure:** open DevTools → Network → set throttling to **Offline**,
or stop the FastAPI gateway.

**What you'll see:** the header pill grows a small count badge — `Live 184ms **1**`
— and **the screen does not blank.** The last good data stays rendered.

**What you do:** click the pill. It flips to `Replay`. Carry on talking.

**Verified behaviour** (tested by killing `fetch` for every `/api/v1/` call):

| | Live, gateway dead | Replay, gateway dead |
| --- | --- | --- |
| Network calls attempted | 1 (fails) | **0** |
| Screen blanks | no | no |
| Data renders | last good | full |
| Confidence gauge | held | 96% |

Replay makes **zero** network calls — the cassette is bundled into the JavaScript,
so it works with the network physically unplugged. Latency is a pure function of the
request path and is byte-identical in both paths, so the pacing does not change.

---

## If a judge asks

| Question | Answer |
| --- | --- |
| "Is this real or mocked?" | "`/live` runs on the gateway contract with fixtures. `/analyze` is fully live — give it any public GitHub repo and it reads the real workflow files." |
| "What if the model is wrong?" | Open `/agent`. "We publish our wrong-auto-fix count. A tool that only reports wins can't be calibrated." |
| "Why not just always fix it?" | "Run #4473. A tool that always says yes is one you can't give write access to." |
| "How does it integrate?" | Open `src/lib/contract/types.ts`. "One adapter file. When the Detection Core changes its shape, this file changes and no screen does." |
| "Does it scale past one repo?" | `/repositories`, `/trends` — 14 days of risk falling from 78 to 31, annotated. |

**If you have 60 more seconds:** open `/analyze`, type any public repo, press
Analyze. Real findings in ~4 seconds. That's the moment that proves it isn't a
mockup.
