'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Alert } from '@/lib/types';
import {
  EmptyState, PageHeader, Panel, SeverityBadge, Skeleton, StatTile,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime, severityRank } from '@/lib/utils';

const kinds: Array<Alert['kind'] | 'all'> = ['all', 'security', 'permission', 'pipeline', 'agent'];

const kindIcon: Record<Alert['kind'], React.ReactNode> = {
  pipeline: <Icon.Pipeline size={14} />,
  permission: <Icon.Lock size={14} />,
  security: <Icon.Shield size={14} />,
  agent: <Icon.Brain size={14} />,
};

export default function AlertsPage() {
  const { t } = useLocale();
  const [kind, setKind] = useState<Alert['kind'] | 'all'>('all');
  const { data, initial } = usePolling<Alert[]>('alerts', 15_000);

  const alerts = (data ?? [])
    .filter((a) => kind === 'all' || a.kind === kind)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const unread = (data ?? []).filter((a) => !a.read).length;
  const critical = (data ?? []).filter((a) => a.severity === 'critical').length;

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Everything that needs an eye, including the agent telling you it declined to act."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Unread" value={unread} tone={unread > 0 ? 'warn' : 'good'} icon={<Icon.Bell size={15} />} />
        <StatTile label="Critical" value={critical} tone={critical > 0 ? 'critical' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Total" value={(data ?? []).length} icon={<Icon.Inbox size={15} />} />
      </div>

      <div className="mb-xl flex flex-wrap gap-md">
        {kinds.map((k) => (
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

      {initial ? (
        <Skeleton className="h-[320px]" />
      ) : alerts.length === 0 ? (
        <Panel><EmptyState title="No alerts in this category" icon={<Icon.Bell size={18} />} /></Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-[color:var(--border-secondary)]">
            {alerts.map((a) => {
              const href = a.investigationId
                ? `/reasoning/${a.investigationId}`
                : a.findingId ? `/findings/${a.findingId}` : '/alerts';
              return (
                <li key={a.id}>
                  <Link href={href} className="flex items-start gap-lg px-3xl py-xl transition-colors hover:bg-primary-hover">
                    <span className={cn('mt-xxs shrink-0', a.read ? 'text-quaternary' : 'text-[color:var(--fg-brand-primary)]')}>
                      {kindIcon[a.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-md">
                        <p className={cn('text-text-sm', a.read ? 'font-medium text-secondary' : 'font-semibold text-primary')}>
                          {t(a.title)}
                        </p>
                        {!a.read ? <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--fg-brand-primary)]" /> : null}
                      </div>
                      <p className="mt-xs max-w-paragraph text-text-sm leading-relaxed text-tertiary">{t(a.body)}</p>
                      <p className="mt-md font-mono text-text-xs text-quaternary">
                        {a.repo} · {relativeTime(a.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0"><SeverityBadge severity={a.severity} /></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
