'use client';

import React from 'react';
import Link from 'next/link';
import type { EvidenceGap, Hypothesis, Investigation, SimilarChange } from '@/lib/types';
import { cn, decisionMeaning, formatDuration, relativeTime } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { ConfidenceMeter, DecisionBadge, Panel, PanelHeader, SeverityBadge } from '@/components/ui/primitives';
import { ConfidenceTrack } from './reasoning-chain';
import { useLocale } from '@/lib/providers';

/**
 * The verdict block that sits above every reasoning chain.
 *
 * It answers, in this order: what did you decide, how sure are you, what rule
 * made that the right call, and how did your certainty move while you worked.
 * The trajectory is included here rather than buried below, because "the line
 * went down at step 5" is the fastest way to show the agent argues with itself.
 */
export function VerdictCard({ investigation }: { investigation: Investigation }) {
  const { t } = useLocale();
  const inv = investigation;
  const decisionStep = inv.steps.find((s) => s.kind === 'decision');
  const dipped = inv.steps.some((s) => s.confidenceDelta < 0);

  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.35fr_1fr]">
        <div className="border-b border-secondary p-3xl lg:border-b-0 lg:border-e">
          <div className="flex flex-wrap items-center gap-md">
            <DecisionBadge decision={inv.decision} />
            <SeverityBadge severity={inv.severity} />
            <span className="font-mono text-text-xs text-quaternary">{inv.findingId}</span>
          </div>

          <h2 dir="auto" className="mt-lg text-text-lg font-semibold leading-snug text-primary">
            {t(inv.title)}
          </h2>

          <p className="mt-md text-text-sm leading-relaxed text-tertiary">
            {decisionMeaning[inv.decision]}
          </p>

          <dl className="mt-xl grid grid-cols-2 gap-x-xl gap-y-lg text-text-sm">
            <div>
              <dt className="text-text-xs uppercase tracking-wide text-quaternary">Repository</dt>
              <dd className="mt-xxs truncate font-mono text-text-xs text-secondary">{inv.repo}</dd>
            </div>
            <div>
              <dt className="text-text-xs uppercase tracking-wide text-quaternary">Pipeline</dt>
              <dd className="mt-xxs truncate text-text-xs text-secondary">{inv.pipeline}</dd>
            </div>
            <div>
              <dt className="text-text-xs uppercase tracking-wide text-quaternary">Commit</dt>
              <dd className="mt-xxs font-mono text-text-xs text-secondary">
                {inv.commit} · {inv.author}
              </dd>
            </div>
            <div>
              <dt className="text-text-xs uppercase tracking-wide text-quaternary">Investigated</dt>
              <dd className="tnum mt-xxs font-mono text-text-xs text-secondary">
                {formatDuration(inv.durationMs)} · {relativeTime(inv.startedAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="p-3xl">
          <div className="flex items-baseline justify-between gap-md">
            <span className="text-text-xs font-medium uppercase tracking-wide text-quaternary">
              Final confidence
            </span>
            <span className="tnum text-display-sm font-semibold text-primary">{inv.confidence}%</span>
          </div>

          <div className="mt-lg">
            <ConfidenceMeter
              value={inv.confidence}
              autoFixFloor={inv.thresholds.autoFixFloor}
              recommendFloor={inv.thresholds.recommendFloor}
              decision={inv.decision}
            />
          </div>

          <p className="mt-lg text-text-xs leading-relaxed text-tertiary">
            Ticks mark the two decision floors in force: <span className="font-mono text-secondary">{inv.thresholds.recommendFloor}%</span> to
            recommend anything at all, <span className="font-mono text-secondary">{inv.thresholds.autoFixFloor}%</span> to act without a human.
          </p>

          <div className="mt-xl border-t border-secondary pt-xl">
            <div className="flex items-center justify-between gap-md">
              <span className="text-text-xs font-medium uppercase tracking-wide text-quaternary">
                Confidence trajectory
              </span>
              {dipped ? (
                <span className="inline-flex items-center gap-xs font-mono text-text-xs text-error-primary">
                  <Icon.ArrowDown size={11} /> self-corrected
                </span>
              ) : null}
            </div>
            <div className="mt-md">
              <ConfidenceTrack
                steps={inv.steps}
                autoFixFloor={inv.thresholds.autoFixFloor}
                recommendFloor={inv.thresholds.recommendFloor}
              />
            </div>
            <p className="mt-md text-text-xs leading-relaxed text-tertiary">
              {dipped
                ? 'A red node marks a step where the agent found evidence against its own working hypothesis and lowered its confidence.'
                : 'Every step in this chain raised or held confidence. No contradicting evidence was found.'}
            </p>
          </div>
        </div>
      </div>

      {decisionStep ? (
        <div
          className={cn(
            'border-t px-3xl py-xl',
            inv.decision === 'auto_fixed' && 'border-[color-mix(in_srgb,var(--decision-autofix)_25%,transparent)] bg-decision-autofix-bg',
            inv.decision === 'flagged' && 'border-[color-mix(in_srgb,var(--decision-flag)_25%,transparent)] bg-decision-flag-bg',
            inv.decision === 'refused' && 'border-dashed border-[color-mix(in_srgb,var(--decision-refuse)_40%,transparent)] bg-decision-refuse-bg',
          )}
        >
          <p className="text-text-xs font-medium uppercase tracking-wide text-quaternary">
            Decision rationale
          </p>
          <p dir="auto" className="mt-xs text-text-sm font-medium leading-relaxed text-primary">
            {t(decisionStep.claim)}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}

/** Competing readings, shown only on refusals. */
export function HypothesisPanel({ hypotheses }: { hypotheses: Hypothesis[] }) {
  const { t } = useLocale();
  if (hypotheses.length === 0) return null;

  const sorted = [...hypotheses].sort((a, b) => b.probability - a.probability);
  const separation = sorted.length > 1
    ? Math.round((sorted[0].probability - sorted[1].probability) * 100)
    : 100;

  return (
    <Panel>
      <PanelHeader
        title="Competing hypotheses"
        description={`Top two readings are ${separation} points apart. Below 15 points the agent is required to refuse.`}
      />
      <div className="divide-y divide-[color:var(--border-secondary)]">
        {sorted.map((h, i) => (
          <div key={i} className="px-3xl py-xl">
            <div className="flex items-center justify-between gap-xl">
              <h3 dir="auto" className="text-text-sm font-semibold text-primary">{t(h.label)}</h3>
              <span className="tnum font-mono text-text-sm text-secondary">
                {(h.probability * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-md h-1.5 w-full overflow-hidden rounded-full bg-quaternary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${h.probability * 100}%`,
                  background: i === 0 ? 'var(--fg-brand-primary)' : 'var(--fg-quaternary)',
                }}
              />
            </div>

            <div className="mt-lg grid gap-xl sm:grid-cols-2">
              <div>
                <p className="text-text-xs font-medium uppercase tracking-wide text-quaternary">Supported by</p>
                <ul className="mt-md space-y-md">
                  {h.supports.map((s, j) => (
                    <li key={j} className="flex gap-md text-text-sm leading-relaxed text-tertiary">
                      <span className="mt-[3px] shrink-0 text-success-primary"><Icon.Check size={12} /></span>
                      <span dir="auto">{t(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-text-xs font-medium uppercase tracking-wide text-quaternary">Argued against by</p>
                <ul className="mt-md space-y-md">
                  {h.contradicts.map((s, j) => (
                    <li key={j} className="flex gap-md text-text-sm leading-relaxed text-tertiary">
                      <span className="mt-[3px] shrink-0 text-error-primary"><Icon.X size={12} /></span>
                      <span dir="auto">{t(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** What the agent does not know, and what would fix that. */
export function EvidenceGapList({ gaps }: { gaps: EvidenceGap[] }) {
  const { t } = useLocale();
  if (gaps.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title="What the agent still does not know"
        description="Naming the gap is what separates judgement from guessing. Each row states the specific observation that would resolve it."
      />
      <ul className="divide-y divide-[color:var(--border-secondary)]">
        {gaps.map((g, i) => (
          <li key={i} className="px-3xl py-xl">
            <div className="flex items-start gap-lg">
              <span className="mt-xxs shrink-0 text-quaternary"><Icon.Search size={15} /></span>
              <div className="min-w-0 flex-1">
                <p dir="auto" className="text-text-sm font-medium text-primary">{t(g.missing)}</p>
                <p className="mt-xs text-text-sm leading-relaxed text-tertiary">
                  <span dir="auto" className="text-quaternary">Resolved by: </span>
                  {t(g.wouldResolve)}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-md py-xxs text-text-xs font-medium',
                  g.obtainableByAgent
                    ? 'border-brand bg-brand-primary-alt text-brand-secondary'
                    : 'border-secondary bg-tertiary text-tertiary',
                )}
              >
                {g.obtainableByAgent ? 'Agent can obtain' : 'Needs a human'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const outcomeStyles: Record<SimilarChange['outcome'], { label: string; cls: string }> = {
  incident: { label: 'Caused an incident', cls: 'text-error-primary' },
  failed_build: { label: 'Broke the build', cls: 'text-warning-primary' },
  reverted: { label: 'Reverted', cls: 'text-warning-primary' },
  clean: { label: 'No follow-on issue', cls: 'text-success-primary' },
};

/** Prior changes the agent matched against. This is the "learns from history"
 *  claim, made concrete and checkable. */
export function SimilarChangesPanel({ changes }: { changes: SimilarChange[] }) {
  const { t } = useLocale();
  if (changes.length === 0) {
    return (
      <Panel>
        <PanelHeader
          title="Similar previous changes"
          description="No comparable change found in 180 days across 12 monitored repositories."
        />
        <div className="px-3xl py-3xl">
          <p className="text-text-sm leading-relaxed text-tertiary">
            Absence of precedent is reported, not treated as absence of risk. It is also not treated as
            evidence of malice — most legitimate integrations start with no precedent either. This is one
            of the inputs that pushed the confidence on this investigation down rather than up.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Similar previous changes"
        description="Matched from pipeline history. Similarity is computed over the config diff shape, job graph position, and permission delta."
      />
      <ul className="divide-y divide-[color:var(--border-secondary)]">
        {changes.map((c) => {
          const o = outcomeStyles[c.outcome];
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-lg px-3xl py-lg">
              <span className="font-mono text-text-xs text-quaternary">{c.commit}</span>
              <span dir="auto" className="min-w-0 flex-1 text-text-sm text-secondary">{t(c.summary)}</span>
              <span className="font-mono text-text-xs text-quaternary">{c.daysAgo}d ago</span>
              <span className={cn('text-text-xs font-medium', o.cls)}>{o.label}</span>
              <span className="tnum w-12 text-end font-mono text-text-xs text-quaternary">
                {(c.similarity * 100).toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
