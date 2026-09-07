import React, { useState } from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Decision, Investigation } from '@/lib/types';
import {
  ConfidenceMeter, DecisionBadge, PageHeader, Panel, SeverityBadge, Skeleton,
} from '@/components/ui/primitives';
import { ConfidenceTrack } from '@/components/reasoning/reasoning-chain';
import { Icon } from '@/components/ui/icons';
import { cn, decisionMeaning, formatDuration, relativeTime } from '@/lib/utils';

const filters: Array<{ key: Decision | 'all'; label: string }> = [
  { key: 'all', label: 'All outcomes' },
  { key: 'auto_fixed', label: 'Auto-fixed' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'refused', label: 'Refused' },
];

function InvestigationCard({ inv }: { inv: Investigation }) {
  const { t } = useLocale();
  const dipped = inv.steps.some((s) => s.confidenceDelta < 0);
  const kinds = inv.steps.map((s) => s.kind);

  return (
    <Link href={`/reasoning/${inv.id}`} className="block">
      <Panel
        className={cn(
          'group h-full transition-colors hover:border-primary',
          inv.decision === 'refused' && 'border-dashed',
        )}
      >
        <div className="flex items-start justify-between gap-lg p-xl pb-lg">
          <DecisionBadge decision={inv.decision} size="sm" />
          <SeverityBadge severity={inv.severity} />
        </div>

        <div className="px-xl">
          <h3 className="text-text-md font-semibold leading-snug text-primary group-hover:underline">
            {t(inv.title)}
          </h3>
          <p className="mt-md font-mono text-text-xs text-quaternary">
            {inv.repo} · {inv.pipeline} · {inv.commit}
          </p>
          <p className="mt-lg text-text-sm leading-relaxed text-tertiary">
            {decisionMeaning[inv.decision]}
          </p>
        </div>

        <div className="mt-xl px-xl">
          <div className="flex items-baseline justify-between gap-md">
            <span className="text-text-xs uppercase tracking-wide text-quaternary">Confidence</span>
            <span className="tnum font-mono text-text-sm font-medium text-primary">{inv.confidence}%</span>
          </div>
          <div className="mt-md">
            <ConfidenceMeter
              value={inv.confidence}
              autoFixFloor={inv.thresholds.autoFixFloor}
              recommendFloor={inv.thresholds.recommendFloor}
              decision={inv.decision}
              showScale={false}
            />
          </div>
        </div>

        <div className="mt-xl px-xl">
          <ConfidenceTrack
            steps={inv.steps}
            autoFixFloor={inv.thresholds.autoFixFloor}
            recommendFloor={inv.thresholds.recommendFloor}
          />
        </div>

        <div className="mt-lg flex flex-wrap items-center gap-md border-t border-secondary px-xl py-lg font-mono text-text-xs text-quaternary">
          <span>{kinds.length} steps</span>
          <span>·</span>
          <span>{formatDuration(inv.durationMs)}</span>
          <span>·</span>
          <span>{relativeTime(inv.startedAt)}</span>
          {dipped ? (
            <span className="ms-auto inline-flex items-center gap-xs text-error-primary">
              <Icon.ArrowDown size={11} /> self-corrected
            </span>
          ) : null}
        </div>
      </Panel>
    </Link>
  );
}

export default function ReasoningCenterPage() {
  const [filter, setFilter] = useState<Decision | 'all'>('all');
  const { data, initial } = usePolling<Investigation[]>('investigations', 20_000);

  const list = (data ?? []).filter((i) => filter === 'all' || i.decision === filter);

  return (
    <>
      <PageHeader
        title="AI reasoning center"
        description="Every decision the agent made, with the argument that produced it. Not a score — a chain you can audit step by step."
        actions={
          <Link
            href="/demo"
            className="inline-flex items-center gap-md rounded-md bg-brand-solid px-xl py-md text-text-sm font-medium text-white transition-colors hover:bg-brand-solid-hover"
          >
            <Icon.Play size={14} />
            Watch all three live
          </Link>
        }
      />

      <Panel className="mb-xl border-dashed">
        <div className="grid gap-xl p-xl sm:grid-cols-3">
          {(['auto_fixed', 'flagged', 'refused'] as Decision[]).map((d) => (
            <div key={d} className="flex items-start gap-lg">
              <DecisionBadge decision={d} size="sm" />
              <p className="text-text-xs leading-relaxed text-tertiary">{decisionMeaning[d]}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mb-xl flex flex-wrap items-center gap-md">
        {filters.map((f) => {
          const count = f.key === 'all'
            ? (data ?? []).length
            : (data ?? []).filter((i) => i.decision === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-md rounded-md border px-lg py-md text-text-sm font-medium transition-colors',
                filter === f.key
                  ? 'border-primary bg-tertiary text-primary'
                  : 'border-secondary bg-primary text-tertiary hover:border-primary',
              )}
            >
              {f.label}
              <span className="tnum font-mono text-text-xs text-quaternary">{count}</span>
            </button>
          );
        })}
      </div>

      {initial ? (
        <div className="grid gap-xl lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[420px]" />)}
        </div>
      ) : (
        <div className="grid gap-xl lg:grid-cols-3">
          {list.map((inv) => <InvestigationCard key={inv.id} inv={inv} />)}
        </div>
      )}
    </>
  );
}
