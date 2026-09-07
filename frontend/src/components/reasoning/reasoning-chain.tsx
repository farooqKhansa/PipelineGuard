'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Investigation, ReasoningStep, StepKind } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { Chip } from '@/components/ui/primitives';
import { useLocale } from '@/lib/providers';

const stepMeta: Record<StepKind, { icon: React.ReactNode; label: string }> = {
  detect: { icon: <Icon.Search size={14} />, label: 'Detection' },
  historical: { icon: <Icon.History size={14} />, label: 'Historical evidence' },
  dependency: { icon: <Icon.Graph size={14} />, label: 'Dependency analysis' },
  impact: { icon: <Icon.Radar size={14} />, label: 'Impact analysis' },
  confidence: { icon: <Icon.Activity size={14} />, label: 'Confidence' },
  decision: { icon: <Icon.Shield size={14} />, label: 'Decision' },
};

/**
 * Confidence trajectory.
 *
 * The single most persuasive four square centimetres in the product. A flat
 * rising line says "scoring function". A line that *drops* at step 5 says the
 * agent found something that argued against its own hypothesis and lowered its
 * own confidence -- which is the difference between judgement and arithmetic.
 */
export function ConfidenceTrack({
  steps, autoFixFloor, recommendFloor, activeIndex,
}: {
  steps: ReasoningStep[];
  autoFixFloor: number;
  recommendFloor: number;
  activeIndex?: number;
}) {
  const w = 100;
  const h = 34;
  const pts = steps.map((s, i) => {
    const x = steps.length === 1 ? 0 : (i / (steps.length - 1)) * w;
    const y = h - (s.confidenceAfter / 100) * h;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[34px] w-full" role="img" aria-label="Confidence trajectory across reasoning steps">
      <line x1="0" x2={w} y1={h - (autoFixFloor / 100) * h} y2={h - (autoFixFloor / 100) * h} stroke="var(--grid-line)" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <line x1="0" x2={w} y1={h - (recommendFloor / 100) * h} y2={h - (recommendFloor / 100) * h} stroke="var(--grid-line)" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <path d={area} fill="var(--fg-brand-primary)" opacity="0.10" />
      <path d={d} fill="none" stroke="var(--fg-brand-primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={activeIndex === i ? 3 : 2}
          fill={steps[i].confidenceDelta < 0 ? 'var(--fg-error-primary)' : 'var(--fg-brand-primary)'}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="tnum font-mono text-text-xs text-quaternary">±0</span>;
  }
  const negative = delta < 0;
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-xxs rounded-md border px-xs py-xxs font-mono text-text-xs',
        negative
          ? 'border-[color-mix(in_srgb,var(--fg-error-primary)_30%,transparent)] bg-error-primary text-error-primary'
          : 'border-secondary bg-tertiary text-tertiary',
      )}
      title={negative ? 'This step lowered the agent confidence' : 'This step raised the agent confidence'}
    >
      {negative ? '−' : '+'}{Math.abs(delta)}
    </span>
  );
}

function Step({
  step, index, total, revealed,
}: {
  step: ReasoningStep;
  index: number;
  total: number;
  revealed: boolean;
}) {
  const { t } = useLocale();
  const meta = stepMeta[step.kind];
  const isDecision = step.kind === 'decision';

  return (
    <li
      className={cn(
        'relative ps-5xl transition-all duration-500 ease-out',
        revealed ? 'opacity-100 blur-0' : 'pointer-events-none translate-y-1 opacity-0 blur-[1px]',
      )}
    >
      {/* Rail node */}
      <span
        className={cn(
          'absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
          isDecision
            ? 'border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]'
            : 'border-secondary bg-primary text-quaternary',
        )}
      >
        {meta.icon}
      </span>

      <div className="pb-4xl">
        <div className="flex flex-wrap items-center gap-md">
          <span className="font-mono text-text-xs uppercase tracking-wider text-quaternary">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · {meta.label}
          </span>
          <DeltaPill delta={step.confidenceDelta} />
          <span className="tnum font-mono text-text-xs text-quaternary">
            → {step.confidenceAfter}%
          </span>
          <span className="tnum ms-auto font-mono text-text-xs text-quaternary">
            {(step.durationMs / 1000).toFixed(2)}s
          </span>
        </div>

        <h3 dir="auto" className="mt-md text-text-sm font-semibold text-primary">{t(step.title)}</h3>

        <p dir="auto"
          className={cn(
            'mt-xs text-text-sm leading-relaxed',
            isDecision ? 'font-medium text-primary' : 'text-secondary',
          )}
        >
          {t(step.claim)}
        </p>

        {step.because.length > 0 ? (
          <ul className="mt-lg space-y-md border-s-2 border-secondary ps-xl">
            {step.because.map((b, i) => (
              <li key={i} className="flex gap-md text-text-sm leading-relaxed text-tertiary">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[color:var(--fg-quaternary)]" />
                <span dir="auto">{t(b)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-lg rounded-md border border-dashed border-error-subtle bg-error-primary px-lg py-md text-text-xs text-error-primary">
            This step asserts a claim with no stated support. Treat it as unverified.
          </p>
        )}

        {step.citations.length > 0 ? (
          <div className="mt-lg flex flex-wrap gap-md">
            {step.citations.map((c, i) => (
              <Chip key={i} tone="mono" href={c.href}>
                <Icon.File size={11} />
                {c.label}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The reasoning chain.
 *
 * @param play  When true, steps reveal one at a time using each step's own
 *              recorded duration. Used by the demo screen so an audience
 *              watches the argument being built rather than reading a wall of
 *              finished text. Timing comes from the data, not from a guess,
 *              so a replayed run paces exactly like a live one.
 */
export function ReasoningChain({
  investigation, play = false, speed = 1, onStepChange,
}: {
  investigation: Investigation;
  play?: boolean;
  speed?: number;
  onStepChange?: (index: number) => void;
}) {
  const steps = investigation.steps;
  const [revealed, setRevealed] = useState(play ? 0 : steps.length);

  // A poll returns a fresh array every time, so keying the playback effect on
  // `steps` would restart the animation mid-sentence. Key it on the
  // investigation instead and read the steps through a ref.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const invId = investigation.id;
  const stepCount = steps.length;

  useEffect(() => {
    if (!play) {
      setRevealed(stepCount);
      return;
    }
    setRevealed(0);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const advance = (i: number) => {
      const current = stepsRef.current;
      if (cancelled || i >= current.length) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        setRevealed(i + 1);
        onStepChangeRef.current?.(i);
        advance(i + 1);
      }, current[i].durationMs / speed);
    };
    advance(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [play, speed, invId, stepCount]);

  const activeIndex = useMemo(() => Math.max(0, revealed - 1), [revealed]);

  return (
    <ol className="reasoning-rail relative">
      {steps.map((s, i) => (
        <Step
          key={s.id}
          step={s}
          index={i}
          total={steps.length}
          revealed={i < revealed}
        />
      ))}
      {play && revealed < steps.length ? (
        <li className="relative ps-5xl">
          <span className="pulse-ring absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
            <Icon.Dot size={10} />
          </span>
          <p className="pt-md font-mono text-text-xs text-quaternary">
            {stepMeta[steps[revealed]?.kind ?? 'detect'].label.toLowerCase()} in progress…
          </p>
        </li>
      ) : null}
      <span className="sr-only" aria-live="polite">
        Step {activeIndex + 1} of {steps.length}
      </span>
    </ol>
  );
}
