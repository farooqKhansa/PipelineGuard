import React, { useState } from 'react';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { AuditEntry } from '@/lib/types';
import {
  Button, EmptyState, PageHeader, Panel, PanelHeader, Skeleton, StatTile,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, formatDateTime } from '@/lib/utils';

const actorKinds: Array<AuditEntry['actorKind'] | 'all'> = ['all', 'agent', 'user', 'system'];

const outcomeMeta: Record<AuditEntry['outcome'], { cls: string; icon: React.ReactNode }> = {
  success: { cls: 'text-success-primary', icon: <Icon.Check size={12} /> },
  failure: { cls: 'text-error-primary', icon: <Icon.X size={12} /> },
  refused: { cls: 'text-[color:var(--decision-refuse)]', icon: <Icon.Hand size={12} /> },
};

export default function AuditPage() {
  const { t } = useLocale();
  const [kind, setKind] = useState<AuditEntry['actorKind'] | 'all'>('all');
  const { data, initial } = usePolling<AuditEntry[]>('audit', 30_000);

  const entries = (data ?? []).filter((e) => kind === 'all' || e.actorKind === kind);
  const agentActions = (data ?? []).filter((e) => e.actorKind === 'agent').length;
  const refusals = (data ?? []).filter((e) => e.outcome === 'refused').length;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every action taken on this organisation, by the agent or by a person. Refusals are recorded as first-class entries, not omitted as non-events."
        actions={<Button variant="secondary"><Icon.File size={13} /> Export report</Button>}
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Total entries" value={(data ?? []).length} icon={<Icon.Book size={15} />} />
        <StatTile label="Agent actions" value={agentActions} icon={<Icon.Brain size={15} />} />
        <StatTile label="Recorded refusals" value={refusals} sub="Deliberate inaction, logged" icon={<Icon.Hand size={15} />} />
      </div>

      <div className="mb-xl flex flex-wrap gap-md">
        {actorKinds.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              'rounded-md border px-lg py-md text-text-sm font-medium capitalize transition-colors',
              kind === k ? 'border-primary bg-tertiary text-primary' : 'border-secondary bg-primary text-tertiary hover:border-primary',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHeader title="Activity" description="Newest first. Times are UTC." />
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-64" /></div>
        ) : entries.length === 0 ? (
          <EmptyState title="No entries for this actor" icon={<Icon.Book size={18} />} />
        ) : (
          <ul className="divide-y divide-[color:var(--border-secondary)]">
            {entries.map((e) => {
              const o = outcomeMeta[e.outcome];
              return (
                <li key={e.id} className="flex items-start gap-lg px-3xl py-lg">
                  <span className={cn('mt-xxs shrink-0', o.cls)}>{o.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-md">
                      <span className="font-mono text-text-xs font-medium text-primary">{e.action}</span>
                      <span className="font-mono text-text-xs text-quaternary">{e.target}</span>
                      <span
                        className={cn(
                          'rounded-md border px-md py-xxs text-text-xs',
                          e.actorKind === 'agent'
                            ? 'border-brand bg-brand-primary-alt text-brand-secondary'
                            : 'border-secondary bg-tertiary text-tertiary',
                        )}
                      >
                        {e.actor}
                      </span>
                    </div>
                    <p className="mt-xs max-w-paragraph text-text-sm leading-relaxed text-tertiary">
                      {t(e.detail)}
                    </p>
                  </div>
                  <span className="tnum shrink-0 font-mono text-text-xs text-quaternary">
                    {formatDateTime(e.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
