import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale, useSource } from '@/lib/providers';
import type { Investigation } from '@/lib/types';
import {
  Button, ConfidenceMeter, DecisionBadge, PageHeader, Panel, PanelHeader, Skeleton,
} from '@/components/ui/primitives';
import { ReasoningChain } from '@/components/reasoning/reasoning-chain';
import { PreventsCallout } from '@/components/fixes/fix-parts';
import { Icon } from '@/components/ui/icons';
import { cn, decisionMeaning } from '@/lib/utils';

const ORDER = ['inv_8f21a4', 'inv_c73e9b', 'inv_2a5d10'];

const acts = [
  {
    id: 'inv_8f21a4',
    kicker: 'Act one',
    heading: 'It acts when it can prove the action is safe',
    point: 'Low blast radius, deterministic remedy, behaviour verified against a previous green run. The agent fixed it and opened a PR for the record.',
  },
  {
    id: 'inv_c73e9b',
    kicker: 'Act two',
    heading: 'It holds back when it cannot prove the fix is safe',
    point: 'The agent wrote the fix, then declined to apply it — because one runtime value it cannot read statically decides whether the patch breaks production.',
  },
  {
    id: 'inv_2a5d10',
    kicker: 'Act three',
    heading: 'It refuses when the evidence does not decide',
    point: 'Two readings, eleven points apart. No fix, no risk score, no guess. It escalated the one question that would resolve it.',
  },
];

/** Wall-clock budget for the demo, in ms. Shown as a live countdown so the
 *  operator knows whether they are inside the three minutes the brief allows. */
const BUDGET_MS = 180_000;

function ActRail({ index, onSelect }: { index: number; onSelect: (i: number) => void }) {
  return (
    <ol className="grid gap-md sm:grid-cols-3">
      {acts.map((a, i) => {
        const state = i < index ? 'done' : i === index ? 'active' : 'upcoming';
        return (
          <li key={a.id}>
            <button
              onClick={() => onSelect(i)}
              className={cn(
                'w-full rounded-lg border px-xl py-lg text-start transition-colors',
                state === 'active' && 'border-brand bg-brand-primary-alt',
                state === 'done' && 'border-secondary bg-secondary',
                state === 'upcoming' && 'border-secondary bg-primary opacity-60',
              )}
            >
              <div className="flex items-center justify-between gap-md">
                <span className={cn(
                  'font-mono text-text-xs uppercase tracking-wider',
                  state === 'active' ? 'text-brand-secondary' : 'text-quaternary',
                )}>
                  {a.kicker}
                </span>
                {state === 'done' ? <span className="text-success-primary"><Icon.Check size={13} /></span> : null}
                {state === 'active' ? <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-[color:var(--fg-brand-primary)]" /> : null}
              </div>
              <p className={cn(
                'mt-xs text-text-sm font-medium leading-snug',
                state === 'upcoming' ? 'text-tertiary' : 'text-primary',
              )}>
                {a.heading}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default function DemoPage() {
  const { t } = useLocale();
  const { mode } = useSource();
  const { data, initial } = usePolling<Investigation[]>('investigations', 0);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2.5);
  const [elapsed, setElapsed] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const startedAt = useRef<number | null>(null);

  const ordered = useMemo(
    () => ORDER.map((id) => (data ?? []).find((i) => i.id === id)).filter(Boolean) as Investigation[],
    [data],
  );
  const current = ordered[index];

  // Elapsed clock, running only while playing.
  useEffect(() => {
    if (!playing) return;
    if (startedAt.current === null) startedAt.current = Date.now() - elapsed;
    const id = setInterval(() => {
      setElapsed(Date.now() - (startedAt.current ?? Date.now()));
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Advance to the next act once the current chain has finished playing.
  const chainMs = current ? current.steps.reduce((a, s) => a + s.durationMs, 0) / speed : 0;
  useEffect(() => {
    if (!playing || !current) return;
    const hold = 3200; // beat after the chain lands, so the verdict is readable
    const timer = setTimeout(() => {
      if (index < ordered.length - 1) {
        setIndex((i) => i + 1);
        setRunKey((k) => k + 1);
      } else {
        setPlaying(false);
      }
    }, chainMs + hold);
    return () => clearTimeout(timer);
  }, [playing, current, chainMs, index, ordered.length, runKey]);

  const restart = useCallback(() => {
    setIndex(0);
    setElapsed(0);
    startedAt.current = null;
    setRunKey((k) => k + 1);
    setPlaying(true);
  }, []);

  const jump = useCallback((i: number) => {
    setIndex(i);
    setRunKey((k) => k + 1);
  }, []);

  if (initial || !current) {
    return (
      <>
        <PageHeader title="Three-outcome demo" description="Loading the demo sequence." />
        <Skeleton className="h-[520px]" />
      </>
    );
  }

  const act = acts[index];
  const overBudget = elapsed > BUDGET_MS;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  return (
    <>
      <PageHeader
        title="Three-outcome demo"
        description="One agent, three different answers, in sequence. A tool that always says yes proves less than one that knows when not to."
        actions={
          <>
            <div className="flex items-center gap-md rounded-md border border-secondary bg-primary px-lg py-md">
              <Icon.Clock size={13} className="text-quaternary" />
              <span className={cn('tnum font-mono text-text-sm', overBudget ? 'text-error-primary' : 'text-secondary')}>
                {mins}:{String(secs).padStart(2, '0')}
              </span>
              <span className="font-mono text-text-xs text-quaternary">/ 3:00</span>
            </div>
            <Button variant={playing ? 'secondary' : 'primary'} onClick={() => (playing ? setPlaying(false) : restart())}>
              {playing ? <><Icon.Pause size={13} /> Pause</> : <><Icon.Play size={13} /> Run demo</>}
            </Button>
          </>
        }
      />

      <div className="mb-xl">
        <ActRail index={index} onSelect={jump} />
      </div>

      <Panel className="mb-xl">
        <div className="flex flex-wrap items-center gap-lg px-xl py-lg">
          <span className="font-mono text-text-xs uppercase tracking-wider text-quaternary">Playback</span>
          {[1, 2.5, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                'rounded-md border px-lg py-xs font-mono text-text-xs transition-colors',
                speed === s ? 'border-primary bg-tertiary text-primary' : 'border-secondary text-tertiary hover:border-primary',
              )}
            >
              {s}×
            </button>
          ))}
          <div className="ms-auto flex items-center gap-md">
            <Button size="sm" variant="ghost" onClick={() => jump(Math.max(0, index - 1))} disabled={index === 0}>
              Previous act
            </Button>
            <Button size="sm" variant="ghost" onClick={() => jump(Math.min(ordered.length - 1, index + 1))} disabled={index === ordered.length - 1}>
              Next act
            </Button>
            <Button size="sm" variant="secondary" onClick={restart}>
              <Icon.Replay size={12} /> Restart
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="mb-xl border-brand bg-brand-primary-alt">
        <div className="px-3xl py-xl">
          <p className="font-mono text-text-xs uppercase tracking-wider text-brand-secondary">{act.kicker}</p>
          <h2 className="mt-xs text-text-xl font-semibold tracking-tight text-primary">{act.heading}</h2>
          <p className="mt-md max-w-paragraph text-text-sm leading-relaxed text-tertiary">{act.point}</p>
        </div>
      </Panel>

      <div className="grid gap-xl lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Panel>
          <PanelHeader
            title="Reasoning chain"
            description={t(current.title)}
            actions={<DecisionBadge decision={current.decision} size="sm" />}
          />
          <div className="px-3xl py-3xl">
            <ReasoningChain
              key={`${current.id}-${runKey}`}
              investigation={current}
              play={playing}
              speed={speed}
            />
          </div>
        </Panel>

        <div className="space-y-xl lg:sticky lg:top-20">
          <Panel>
            <PanelHeader title="Verdict" />
            <div className="px-3xl py-xl">
              <DecisionBadge decision={current.decision} />
              <p className="mt-lg text-text-sm leading-relaxed text-tertiary">
                {decisionMeaning[current.decision]}
              </p>

              <div className="mt-xl">
                <div className="flex items-baseline justify-between">
                  <span className="text-text-xs uppercase tracking-wide text-quaternary">Confidence</span>
                  <span className="tnum font-mono text-text-lg font-semibold text-primary">{current.confidence}%</span>
                </div>
                <div className="mt-md">
                  <ConfidenceMeter
                    value={current.confidence}
                    autoFixFloor={current.thresholds.autoFixFloor}
                    recommendFloor={current.thresholds.recommendFloor}
                    decision={current.decision}
                  />
                </div>
              </div>

              <Link
                href={`/reasoning/${current.id}`}
                className="mt-xl inline-flex items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline"
              >
                Open full investigation <Icon.ArrowRight size={13} />
              </Link>
            </div>
          </Panel>

          {current.fix ? (
            <PreventsCallout fix={current.fix} />
          ) : (
            <Panel className="border-dashed">
              <div className="px-3xl py-xl">
                <div className="flex items-start gap-lg">
                  <span className="mt-xxs shrink-0 text-[color:var(--decision-refuse)]"><Icon.Hand size={18} /></span>
                  <div>
                    <p className="text-text-xs font-semibold uppercase tracking-wider text-quaternary">
                      What this deliberately does not do
                    </p>
                    <p className="mt-xs text-text-md font-medium leading-relaxed text-primary">
                      No fix was drafted and no risk score was published, because both would require assuming
                      an intent the evidence does not establish.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Demo integrity" dense />
            <dl className="space-y-md px-xl py-lg text-text-xs">
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Source</dt>
                <dd className="font-mono text-secondary">{mode === 'replay' ? 'recorded cassette' : 'live gateway'}</dd>
              </div>
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Step timing</dt>
                <dd className="font-mono text-secondary">from recorded durations</dd>
              </div>
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Act sequence</dt>
                <dd className="font-mono text-secondary">{index + 1} of {ordered.length}</dd>
              </div>
            </dl>
            <p className="border-t border-secondary px-xl py-lg text-text-xs leading-relaxed text-tertiary">
              Live and replay run the same code path and the same per-step timings, so this sequence paces
              identically either way. <Link href="/replay" className="text-brand-secondary hover:underline">Replay center</Link>
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
