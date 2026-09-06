'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Decision } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Animated number.
 *
 * Risk and confidence are the two most-watched values on screen, and a number
 * that snaps from 0 to 88 reads as a static render. Counting up reads as a
 * measurement being taken. Eased, tabular-figure, and reduced-motion aware.
 */
export function AnimatedNumber({
  value, duration = 900, suffix = '', className,
}: { value: number; duration?: number; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(value); from.current = value; return; }

    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo: fast commitment, gentle settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(origin + (value - origin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={cn('tnum', className)}>{display}{suffix}</span>;
}

const DECISION_COLOUR: Record<Decision, string> = {
  auto_fixed: 'var(--decision-autofix)',
  flagged: 'var(--decision-flag)',
  refused: 'var(--decision-refuse)',
};

/**
 * Radial confidence gauge.
 *
 * A progress bar answers "how full is it". This answers the question that
 * actually matters: where does this number sit relative to the two thresholds
 * that govern what the agent is allowed to do. The floors are drawn as ticks
 * on the arc, and the arc sweeps on mount so the value arrives rather than
 * appearing.
 */
export function ConfidenceGauge({
  value,
  decision,
  autoFixFloor = 90,
  recommendFloor = 45,
  size = 190,
  label = 'confidence',
  animate = true,
}: {
  value: number;
  decision?: Decision;
  autoFixFloor?: number;
  recommendFloor?: number;
  size?: number;
  label?: string;
  animate?: boolean;
}) {
  const stroke = 12;
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 240-degree arc starting at 150deg, so the opening sits at the bottom.
  const START = 150;
  const SWEEP = 240;
  const circumference = 2 * Math.PI * r;
  const arcLength = (SWEEP / 360) * circumference;

  const [progress, setProgress] = useState(animate ? 0 : value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) { setProgress(value); return; }
    const id = requestAnimationFrame(() => setProgress(value));
    return () => cancelAnimationFrame(id);
  }, [value, animate]);

  const colour = decision ? DECISION_COLOUR[decision] : 'var(--fg-brand-primary)';
  const dash = (progress / 100) * arcLength;

  const tickAt = (pct: number) => {
    const angle = ((START + (pct / 100) * SWEEP) * Math.PI) / 180;
    const inner = r - stroke / 2 - 2;
    const outer = r + stroke / 2 + 2;
    return {
      x1: cx + Math.cos(angle) * inner,
      y1: cy + Math.sin(angle) * inner,
      x2: cx + Math.cos(angle) * outer,
      y2: cy + Math.sin(angle) * outer,
    };
  };

  const recommend = tickAt(recommendFloor);
  const auto = tickAt(autoFixFloor);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-0">
        <g transform={`rotate(${START} ${cx} ${cy})`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="var(--bg-quaternary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 1100ms cubic-bezier(0.16, 1, 0.3, 1), stroke 400ms ease' }}
          />
        </g>

        {/* Threshold ticks — the reason this is a gauge and not a dial. */}
        <line {...recommend} stroke="var(--text-quaternary)" strokeWidth="2" strokeLinecap="round" />
        <line {...auto} stroke="var(--text-quaternary)" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={value}
          suffix="%"
          className="text-display-md font-semibold tracking-tight text-primary"
        />
        <span className="mt-xxs text-text-xs uppercase tracking-wider text-quaternary">{label}</span>
        {decision ? (
          <span
            className="mt-md rounded-full border px-lg py-xxs text-text-xs font-medium"
            style={{
              color: colour,
              borderColor: `color-mix(in srgb, ${colour} 40%, transparent)`,
              background: `color-mix(in srgb, ${colour} 10%, transparent)`,
            }}
          >
            {decision === 'auto_fixed' ? 'auto-fix'
              : decision === 'flagged' ? 'propose w/ caution' : 'escalate'}
          </span>
        ) : null}
      </div>

      <span className="sr-only">
        {label} {value} percent. Recommendation floor {recommendFloor}, auto-fix floor {autoFixFloor}.
      </span>
    </div>
  );
}

/**
 * Risk meter.
 *
 * Deliberately NOT red at the top end. This is a tool that reports a
 * measurement, not a fire alarm — so the scale runs calm-blue through amber,
 * and the highest band is a deep clay rather than emergency red.
 */
export function RiskMeter({ score, className }: { score: number; className?: string }) {
  const band = score >= 80 ? 'severe' : score >= 60 ? 'elevated' : score >= 35 ? 'moderate' : 'low';
  const colour = {
    low: 'var(--fg-success-primary)',
    moderate: 'var(--sev-medium)',
    elevated: 'var(--risk-elevated)',
    severe: 'var(--risk-severe)',
  }[band];

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-md">
        <span className="text-text-xs uppercase tracking-wider text-quaternary">risk score</span>
        <span className="text-text-xs font-medium capitalize" style={{ color: colour }}>{band}</span>
      </div>
      <div className="mt-md flex items-end gap-lg">
        <AnimatedNumber value={score} className="text-display-lg font-semibold leading-none tracking-tight" />
        <span className="pb-xs font-mono text-text-sm text-quaternary">/ 100</span>
      </div>
      <div className="relative mt-lg h-2 w-full overflow-hidden rounded-full bg-quaternary">
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: colour,
            transition: 'width 1100ms cubic-bezier(0.16, 1, 0.3, 1), background 400ms ease',
          }}
        />
        {[35, 60, 80].map((t) => (
          <span key={t} className="absolute top-0 h-full w-px bg-[color:var(--bg-primary)]/60" style={{ left: `${t}%` }} />
        ))}
      </div>
    </div>
  );
}
