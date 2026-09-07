import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale, useSource } from '@/lib/providers';
import type { PipelineRunAnalysis, RunFeedResponse } from '@/lib/contract/types';
import { adaptRun, type AdaptResult } from '@/lib/contract/adapt';
import type { Investigation } from '@/lib/types';
import {
  Button, DecisionBadge, PageHeader, Panel, PanelHeader, SeverityBadge, Skeleton,
} from '@/components/ui/primitives';
import { AnimatedNumber, ConfidenceGauge, RiskMeter } from '@/components/ui/gauge';
import { LivePropagationGraph } from '@/components/graph/live-graph';
import { ReasoningChain } from '@/components/reasoning/reasoning-chain';
import { BeforeAfterDiff } from '@/components/fixes/split-diff';
import { PreventsCallout, ValidationPanel } from '@/components/fixes/fix-parts';
import { Icon } from '@/components/ui/icons';
import { cn, decisionMeaning } from '@/lib/utils';

/**
 * LIVE RUN VIEW
 *
 * The screen judges watch. It walks one pipeline run through the four stages
 * the pipeline actually has -- queued, analysing, deciding, complete -- and
 * gives each stage its own visual treatment, because a judge will see all of
 * them and a default spinner in any one of them undoes the rest.
 *
 * Everything on screen is adapted from the contract payloads in
 * src/lib/contract/types.ts, so this is also the proof that the integration
 * shape works end to end.
 */

type Stage = 'idle' | 'queued' | 'analyzing' | 'detected' | 'deciding' | 'complete';

const STAGE_ORDER: Stage[] = ['queued', 'analyzing', 'detected', 'deciding', 'complete'];

const STAGE_COPY: Record<Exclude<Stage, 'idle'>, { label: string; detail: string }> = {
  queued: { label: 'Queued', detail: 'Run picked up from the CI provider' },
  analyzing: { label: 'Analyzing', detail: 'Detection Core reading workflow and run history' },
  detected: { label: 'Risk detected', detail: 'Score and contributing signals returned' },
  deciding: { label: 'Agent deciding', detail: 'Weighing evidence against the decision floors' },
  complete: { label: 'Decision', detail: 'Outcome reached and explained' },
};

/** Wall-clock budget per stage. Matches the recorded timings, so replay and
 *  live pace identically. */
const STAGE_MS: Record<string, number> = {
  queued: 700,
  analyzing: 2600,
  detected: 1400,
  deciding: 2200,
  complete: 0,
};

function StageRail({ stage, onScrub }: { stage: Stage; onScrub?: (s: Stage) => void }) {
  const currentIndex = STAGE_ORDER.indexOf(stage as Exclude<Stage, 'idle'>);
  return (
    <ol className="grid gap-md sm:grid-cols-5">
      {STAGE_ORDER.map((s, i) => {
        const state = stage === 'idle' ? 'upcoming'
          : i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming';
        return (
          <li key={s}>
            <button
              onClick={() => onScrub?.(s)}
              disabled={!onScrub}
              className={cn(
                'w-full rounded-lg border px-lg py-md text-start transition-all duration-300',
                state === 'active' && 'border-brand bg-brand-primary-alt',
                state === 'done' && 'border-secondary bg-secondary',
                state === 'upcoming' && 'border-secondary bg-primary opacity-45',
              )}
            >
              <div className="flex items-center justify-between gap-md">
                <span className={cn(
                  'font-mono text-text-xs uppercase tracking-wider',
                  state === 'active' ? 'text-brand-secondary' : 'text-quaternary',
                )}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {state === 'done' ? <span className="text-success-primary"><Icon.Check size={12} /></span> : null}
                {state === 'active' ? (
                  <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-[color:var(--fg-brand-primary)]" />
                ) : null}
              </div>
              <p className={cn(
                'mt-xs text-text-sm font-medium',
                state === 'upcoming' ? 'text-tertiary' : 'text-primary',
              )}>
                {STAGE_COPY[s as Exclude<Stage, 'idle'>].label}
              </p>
              <p className="mt-xxs text-text-xs leading-snug text-quaternary">
                {STAGE_COPY[s as Exclude<Stage, 'idle'>].detail}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Stage-specific centre panel. Never a bare spinner. */
function StagePanel({
  stage, run, adapted,
}: { stage: Stage; run: PipelineRunAnalysis; adapted: AdaptResult }) {
  const { t } = useLocale();
  const risk = run.risk;
  const path = useMemo(() => {
    const p = risk.graph_path ?? [];
    if (p.length === 0) return [];
    if (typeof p[0] === 'string') return p as string[];
    const edges = p as Array<{ from: string; to: string }>;
    return [edges[0].from, ...edges.map((e) => e.to)];
  }, [risk.graph_path]);

  if (stage === 'queued') {
    return (
      <div className="stage-in flex flex-col items-center justify-center py-7xl text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-secondary bg-tertiary text-quaternary">
          <Icon.Clock size={20} />
        </span>
        <p className="mt-xl text-text-md font-medium text-primary">Run queued</p>
        <p className="mt-xs font-mono text-text-sm text-quaternary">
          {run.repo} · {run.workflow} · {run.commit}
        </p>
      </div>
    );
  }

  if (stage === 'analyzing') {
    return (
      <div className="stage-in py-4xl">
        <div className="flex items-center justify-center gap-lg">
          <span className="pulse-ring flex h-10 w-10 items-center justify-center rounded-full border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
            <Icon.Radar size={18} />
          </span>
          <div>
            <p className="text-text-md font-medium text-primary">
              Detection Core analyzing<span className="caret" />
            </p>
            <p className="mt-xxs font-mono text-text-xs text-quaternary">
              reading {run.workflow} and recent run history
            </p>
          </div>
        </div>

        {/* A scanned representation of the file being read, rather than a spinner. */}
        <div className="scanline relative mx-auto mt-3xl max-w-md overflow-hidden rounded-lg border border-secondary bg-secondary p-xl">
          {['name:', 'on:', 'permissions:', 'jobs:', '  build:', '  deploy:', '    environment:'].map((l, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-quaternary"
              style={{ width: `${90 - i * 9}%`, marginTop: i ? 10 : 0, opacity: 0.5 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'detected') {
    return (
      <div className="stage-in py-3xl">
        <div className="mx-auto max-w-md">
          <RiskMeter score={risk.risk_score} />
        </div>

        <div className="mt-4xl">
          <p className="mb-lg text-center text-text-xs uppercase tracking-wider text-quaternary">
            contributing signals
          </p>
          <ul className="mx-auto max-w-lg space-y-md">
            {(risk.reasons ?? []).slice(0, 3).map((r, i) => {
              const text = typeof r === 'string' ? r : (r.message ?? r.reason ?? '');
              const weight = typeof r === 'string' ? null : r.weight ?? null;
              return (
                <li
                  key={i}
                  className="stage-in flex items-start gap-lg rounded-lg border border-secondary bg-primary px-lg py-md"
                  style={{ animationDelay: `${i * 160}ms` }}
                >
                  <span className="mt-xxs shrink-0 text-quaternary"><Icon.Dot size={9} /></span>
                  <span className="flex-1 text-text-sm leading-relaxed text-secondary">{text}</span>
                  {weight !== null ? (
                    <span className="tnum shrink-0 font-mono text-text-xs text-quaternary">
                      {(weight * 100).toFixed(0)}%
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {path.length > 0 ? (
          <div className="mt-4xl">
            <p className="mb-lg text-center text-text-xs uppercase tracking-wider text-quaternary">
              propagation path
            </p>
            <LivePropagationGraph path={path} flowing className="justify-center" />
          </div>
        ) : null}
      </div>
    );
  }

  if (stage === 'deciding') {
    const breakdown = risk.model_breakdown ?? {};
    return (
      <div className="stage-in py-4xl">
        <div className="flex items-center justify-center gap-lg">
          <span className="pulse-ring flex h-10 w-10 items-center justify-center rounded-full border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
            <Icon.Brain size={18} />
          </span>
          <div>
            <p className="text-text-md font-medium text-primary">
              Agent deciding<span className="caret" />
            </p>
            <p className="mt-xxs font-mono text-text-xs text-quaternary">
              weighing evidence against the decision floors
            </p>
          </div>
        </div>

        {Object.keys(breakdown).length > 0 ? (
          <div className="mx-auto mt-3xl max-w-md space-y-lg">
            {Object.entries(breakdown).map(([model, v], i) => (
              <div key={model} className="stage-in" style={{ animationDelay: `${i * 180}ms` }}>
                <div className="flex items-baseline justify-between gap-md">
                  <span className="font-mono text-text-xs text-tertiary">{model}</span>
                  <span className="tnum font-mono text-text-xs text-secondary">{(v * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-xs h-1.5 w-full overflow-hidden rounded-full bg-quaternary">
                  <div
                    className="h-full rounded-full bg-brand-solid"
                    style={{ width: `${v * 100}%`, transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // complete
  const inv = adapted.investigation;
  return (
    <div className="stage-in py-xl">
      <div className="flex flex-col items-center">
        <ConfidenceGauge
          value={inv.confidence}
          decision={inv.decision}
          autoFixFloor={inv.thresholds.autoFixFloor}
          recommendFloor={inv.thresholds.recommendFloor}
        />
        <p className="mt-xl max-w-md text-center text-text-sm leading-relaxed text-tertiary">
          {decisionMeaning[inv.decision]}
        </p>
      </div>
    </div>
  );
}

export default function LiveRunPage() {
  const { t } = useLocale();
  const { mode } = useSource();
  // The old feed shape contains demo-era derived values. Keep this visual
  // replay available, but never present it as a live Detection Core result.
  const { data, initial } = usePolling<RunFeedResponse>(mode === 'replay' ? 'feed' : null, 0);

  const runs = data?.runs ?? [];
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = runs[index];
  const adapted = useMemo(() => (run ? adaptRun(run) : null), [run]);

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  const advance = useCallback((from: Stage) => {
    const i = STAGE_ORDER.indexOf(from as Exclude<Stage, 'idle'>);
    if (i === -1 || i >= STAGE_ORDER.length - 1) { setPlaying(false); return; }
    const next = STAGE_ORDER[i + 1];
    timer.current = setTimeout(() => {
      setStage(next);
      advance(next);
    }, STAGE_MS[from] ?? 1200);
  }, []);

  const start = useCallback(() => {
    clear();
    setStage('queued');
    setPlaying(true);
    advance('queued');
  }, [advance]);

  useEffect(() => () => clear(), []);

  if (mode !== 'replay') {
    return (
      <>
        <PageHeader
          title="Live run"
          description="Live repository analysis now runs from Analyze a repository through the Archive A FastAPI gateway."
          actions={
            <Link
              href="/analyze"
              className="inline-flex items-center gap-md rounded-md bg-brand-solid px-xl py-md text-text-sm font-medium text-white transition-colors hover:bg-brand-solid-hover"
            >
              <Icon.Radar size={14} /> Analyze a repository
            </Link>
          }
        />
        <Panel className="border-dashed">
          <div className="flex items-start gap-lg p-3xl">
            <span className="mt-xxs text-brand-secondary"><Icon.Alert size={18} /></span>
            <div>
              <p className="text-text-md font-semibold text-primary">Recorded run view is isolated</p>
              <p className="mt-xs max-w-2xl text-text-sm leading-relaxed text-tertiary">
                This screen uses the bundled replay cassette only. Switch the source pill to Replay
                for the three-outcome walkthrough; Live analysis uses the real backend and the
                conservative evidence states on the Analyze screen.
              </p>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  if (initial || !run || !adapted) {
    return (
      <>
        <PageHeader title="Live run" description="Connecting to the run feed." />
        <Skeleton className="h-[520px]" />
      </>
    );
  }

  const inv = adapted.investigation;
  const complete = stage === 'complete';

  return (
    <>
      <PageHeader
        title="Live run"
        description="One pipeline run, watched end to end: queued, analysed by the Detection Core, decided by the Agentic Layer, explained. Every value on this screen is adapted from the gateway contract."
        actions={
          <>
            <div className="flex items-center rounded-md border border-secondary bg-primary p-xxs">
              {runs.map((r, i) => (
                <button
                  key={r.run_id}
                  onClick={() => { clear(); setIndex(i); setStage('idle'); setPlaying(false); }}
                  className={cn(
                    'rounded px-lg py-xs font-mono text-text-xs transition-colors',
                    i === index ? 'bg-tertiary text-primary' : 'text-quaternary hover:text-tertiary',
                  )}
                >
                  {r.run_id.replace('run_', '#')}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={start}>
              <Icon.Play size={13} /> {playing ? 'Restart run' : 'Run analysis'}
            </Button>
          </>
        }
      />

      <div className="mb-xl">
        <StageRail stage={stage} onScrub={(s) => { clear(); setPlaying(false); setStage(s); }} />
      </div>

      <div className="grid gap-xl lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <Panel className="min-h-[420px]">
          <PanelHeader
            title={stage === 'idle' ? 'Ready' : STAGE_COPY[stage as Exclude<Stage, 'idle'>].label}
            description={`${run.repo} · ${run.workflow} · ${run.commit} by ${run.author}`}
            actions={complete ? <DecisionBadge decision={inv.decision} size="sm" /> : null}
          />
          {stage === 'idle' ? (
            <div className="flex flex-col items-center justify-center py-8xl text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-secondary bg-tertiary text-quaternary">
                <Icon.Play size={20} />
              </span>
              <p className="mt-xl text-text-md font-medium text-primary">Run analysis</p>
              <p className="mt-xs max-w-sm text-text-sm leading-relaxed text-tertiary">
                Walks this run through all four stages at recorded pace. Identical in live and replay.
              </p>
            </div>
          ) : (
            <StagePanel stage={stage} run={run} adapted={adapted} />
          )}
        </Panel>

        <div className="space-y-xl lg:sticky lg:top-20">
          <Panel>
            <PanelHeader title="Run" dense />
            <dl className="space-y-md px-xl py-lg text-text-sm">
              {[
                ['Run id', run.run_id],
                ['Status', run.status ?? 'unknown'],
                ['Branch', run.branch ?? '—'],
                ['Source', mode === 'replay' ? 'recorded cassette' : 'live gateway'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-lg">
                  <dt className="text-quaternary">{k}</dt>
                  <dd className="font-mono text-text-xs text-secondary">{v}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-lg">
                <dt className="text-quaternary">Risk</dt>
                <dd className="font-mono text-text-xs text-secondary">
                  {stage === 'idle' || stage === 'queued' || stage === 'analyzing'
                    ? '—'
                    : <AnimatedNumber value={run.risk.risk_score} suffix=" / 100" />}
                </dd>
              </div>
            </dl>
          </Panel>

          {adapted.missing.length > 0 ? (
            <Panel className="border-dashed">
              <PanelHeader
                title="Contract gaps"
                description="Fields the gateway did not supply. Reported rather than filled in."
                dense
              />
              <ul className="space-y-md px-xl py-lg">
                {adapted.missing.map((m, i) => (
                  <li key={i} className="flex gap-md text-text-xs leading-relaxed text-tertiary">
                    <span className="mt-xxs shrink-0 text-quaternary"><Icon.Alert size={11} /></span>
                    <span className="font-mono">{m}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {complete && adapted.fix ? <PreventsCallout fix={adapted.fix} /> : null}

          {complete && !adapted.fix ? (
            <Panel className="border-dashed">
              <div className="px-xl py-lg">
                <div className="flex items-start gap-lg">
                  <span className="mt-xxs shrink-0 text-[color:var(--decision-refuse)]"><Icon.Hand size={18} /></span>
                  <div>
                    <p className="text-text-xs font-semibold uppercase tracking-wider text-quaternary">
                      No fix was drafted
                    </p>
                    <p className="mt-xs text-text-sm leading-relaxed text-primary">
                      Escalated to a human. Drafting a patch would require assuming an intent the evidence
                      does not establish.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {complete ? (
        <>
          <div className="mt-xl grid gap-xl lg:grid-cols-[1.35fr_1fr] lg:items-start">
            <Panel>
              <PanelHeader
                title="Reasoning chain"
                description="Adapted from the agent's reasoning_log where supplied, otherwise synthesised from the risk payload — each step citing a field that actually arrived."
                actions={<span className="font-mono text-text-xs text-quaternary">{inv.steps.length} steps</span>}
              />
              <div className="px-3xl py-3xl">
                <ReasoningChain investigation={inv} play speed={2.2} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Agent explanation" description="Toggle EN / اردو in the header." />
              <div className="px-3xl py-xl">
                <p dir="auto" className="text-text-sm leading-relaxed text-secondary">
                  {t(inv.steps[inv.steps.length - 1].claim)}
                </p>
                <div className="mt-xl flex flex-wrap items-center gap-md">
                  <SeverityBadge severity={inv.severity} />
                  <DecisionBadge decision={inv.decision} size="sm" />
                </div>
              </div>
            </Panel>
          </div>

          {adapted.fix ? (
            <div className="mt-xl space-y-xl">
              <BeforeAfterDiff fix={adapted.fix} />
              <ValidationPanel fix={adapted.fix} />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
