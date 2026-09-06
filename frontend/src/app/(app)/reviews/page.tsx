'use client';

import React from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { ReviewItem } from '@/lib/types';
import {
  Button, EmptyState, PageHeader, Panel, PanelHeader, SeverityBadge, Skeleton, StatTile,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

const statusMeta: Record<ReviewItem['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'border-[color-mix(in_srgb,var(--decision-flag)_35%,transparent)] bg-warning-primary text-warning-primary' },
  approved: { label: 'Approved', cls: 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary' },
  rejected: { label: 'Rejected', cls: 'border-error bg-error-primary text-error-primary' },
  info_requested: { label: 'Question open', cls: 'border-brand bg-brand-primary-alt text-brand-secondary' },
};

export default function ReviewQueuePage() {
  const { t } = useLocale();
  const { data, initial } = usePolling<ReviewItem[]>('reviews', 20_000);
  const reviews = data ?? [];

  const pending = reviews.filter((r) => r.status === 'pending').length;
  const questions = reviews.filter((r) => r.status === 'info_requested').length;
  const urgent = reviews.filter((r) => r.slaHoursRemaining < 8 && r.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Where the agent stops and a human decides. Every item states why it could not be resolved autonomously."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Pending approval" value={pending} sub="Fixes drafted and held" tone={pending > 0 ? 'warn' : 'good'} icon={<Icon.Inbox size={15} />} />
        <StatTile label="Open questions" value={questions} sub="Agent asked rather than guessed" icon={<Icon.Search size={15} />} />
        <StatTile label="Breaching SLA soon" value={urgent} sub="Under 8 hours remaining" tone={urgent > 0 ? 'critical' : 'good'} icon={<Icon.Clock size={15} />} />
      </div>

      {initial ? (
        <div className="space-y-xl">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[200px]" />)}</div>
      ) : reviews.length === 0 ? (
        <Panel><EmptyState title="Nothing waiting on a human" icon={<Icon.Check size={18} />} /></Panel>
      ) : (
        <div className="space-y-xl">
          {reviews.map((r) => {
            const meta = statusMeta[r.status];
            const noFix = !r.fixId;
            return (
              <Panel key={r.id} className={cn(noFix && 'border-dashed')}>
                <PanelHeader
                  title={t(r.title)}
                  description={`${r.repo} · requested ${relativeTime(r.requestedAt)}`}
                  actions={
                    <>
                      <SeverityBadge severity={r.severity} />
                      <span className={cn('rounded-full border px-lg py-xs text-text-xs font-medium', meta.cls)}>
                        {meta.label}
                      </span>
                    </>
                  }
                />
                <div className="px-3xl py-xl">
                  <p className="text-text-xs font-medium uppercase tracking-wide text-quaternary">
                    Why a human is in the loop
                  </p>
                  <p className="mt-xs max-w-paragraph text-text-sm leading-relaxed text-secondary">
                    {t(r.reason)}
                  </p>

                  <div className="mt-xl flex flex-wrap items-center gap-xl">
                    <div className="flex items-center gap-md">
                      <span className="text-text-xs text-quaternary">Approvals</span>
                      <span className="tnum font-mono text-text-sm text-primary">
                        {r.approvals.length} / {r.requiredApprovals}
                      </span>
                      <div className="flex gap-xxs">
                        {Array.from({ length: r.requiredApprovals }).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              'h-1.5 w-6 rounded-full',
                              i < r.approvals.length ? 'bg-success-solid' : 'bg-quaternary',
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-md">
                      <Icon.Clock size={13} className="text-quaternary" />
                      <span className={cn('tnum font-mono text-text-sm', r.slaHoursRemaining < 8 ? 'text-error-primary' : 'text-tertiary')}>
                        {r.slaHoursRemaining}h remaining
                      </span>
                    </div>

                    <div className="ms-auto flex flex-wrap items-center gap-md">
                      {r.investigationId ? (
                        <Link href={`/reasoning/${r.investigationId}`}>
                          <Button size="sm" variant="ghost"><Icon.Brain size={12} /> Reasoning</Button>
                        </Link>
                      ) : null}
                      {r.fixId ? (
                        <Link href={`/fixes/${r.fixId}`}>
                          <Button size="sm" variant="secondary"><Icon.Wrench size={12} /> Review the diff</Button>
                        </Link>
                      ) : null}
                      <Button size="sm" variant="secondary">Request more info</Button>
                      <Button size="sm" variant="primary" disabled={noFix}>
                        {noFix ? 'Nothing to approve' : 'Approve fix'}
                      </Button>
                    </div>
                  </div>

                  {noFix ? (
                    <p className="mt-lg rounded-md border border-dashed border-primary bg-tertiary px-lg py-md text-text-xs leading-relaxed text-tertiary">
                      There is no diff to approve here. The agent refused to draft one and escalated a
                      question instead — answering it is the action this item needs.
                    </p>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
