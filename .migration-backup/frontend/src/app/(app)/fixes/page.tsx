'use client';

import React from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Fix } from '@/lib/types';
import { EmptyState, PageHeader, Panel, PanelHeader, Skeleton, StatTile } from '@/components/ui/primitives';
import { PreventsCallout } from '@/components/fixes/fix-parts';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const statusMeta: Record<Fix['status'], { label: string; cls: string; note: string }> = {
  applied: { label: 'Applied', cls: 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary', note: 'Merged by the agent after validation.' },
  awaiting_review: { label: 'Awaiting review', cls: 'border-[color-mix(in_srgb,var(--decision-flag)_35%,transparent)] bg-warning-primary text-warning-primary', note: 'Drafted and deliberately held.' },
  proposed: { label: 'Proposed', cls: 'border-secondary bg-tertiary text-tertiary', note: 'Not yet validated.' },
  rejected: { label: 'Rejected', cls: 'border-secondary bg-tertiary text-tertiary', note: 'A reviewer declined this fix.' },
  reverted: { label: 'Reverted', cls: 'border-[color-mix(in_srgb,var(--fg-error-primary)_30%,transparent)] bg-error-primary text-error-primary', note: 'Rolled back after merge.' },
};

export default function FixCenterPage() {
  const { t } = useLocale();
  const { data, initial } = usePolling<Fix[]>('fixes', 20_000);
  const fixes = data ?? [];

  const applied = fixes.filter((f) => f.status === 'applied').length;
  const held = fixes.filter((f) => f.status === 'awaiting_review').length;
  const verified = fixes.filter((f) => f.validation.verified).length;

  return (
    <>
      <PageHeader
        title="Fix center"
        description="Every fix the agent generated, what it prevents, and how far it was validated before anyone was asked to trust it."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Applied" value={applied} sub="Merged autonomously after validation" tone="good" icon={<Icon.Check size={15} />} />
        <StatTile label="Held for review" value={held} sub="Fix written, application withheld" tone="warn" icon={<Icon.Hand size={15} />} />
        <StatTile label="Fully verified" value={`${verified} / ${fixes.length}`} sub="Executed, not just proposed" icon={<Icon.ShieldCheck size={15} />} />
      </div>

      {initial ? (
        <div className="space-y-xl">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[240px]" />)}
        </div>
      ) : fixes.length === 0 ? (
        <Panel>
          <EmptyState title="No fixes generated yet" icon={<Icon.Wrench size={18} />} />
        </Panel>
      ) : (
        <div className="space-y-xl">
          {fixes.map((fix) => {
            const meta = statusMeta[fix.status];
            const failed = fix.validation.checks.filter((c) => c.status === 'failed').length;
            return (
              <Panel key={fix.id}>
                <PanelHeader
                  title={
                    <Link href={`/fixes/${fix.id}`} className="hover:underline">
                      {t(fix.title)}
                    </Link>
                  }
                  description={fix.filePath}
                  actions={
                    <span className={cn('rounded-full border px-lg py-xs text-text-xs font-medium', meta.cls)}>
                      {meta.label}
                    </span>
                  }
                />
                <div className="p-3xl">
                  <PreventsCallout fix={fix} />

                  <div className="mt-xl grid gap-xl sm:grid-cols-[1fr_auto] sm:items-end">
                    <p className="max-w-paragraph text-text-sm leading-relaxed text-tertiary">
                      {t(fix.rationale)}
                    </p>
                    <Link
                      href={`/fixes/${fix.id}`}
                      className="inline-flex shrink-0 items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline"
                    >
                      Before / after and validation <Icon.ArrowRight size={13} />
                    </Link>
                  </div>

                  <div className="mt-xl flex flex-wrap items-center gap-xl border-t border-secondary pt-xl font-mono text-text-xs text-quaternary">
                    <span>{meta.note}</span>
                    <span className={cn(fix.validation.verified ? 'text-success-primary' : 'text-warning-primary')}>
                      {fix.validation.verified
                        ? `${fix.validation.checks.length} checks passed`
                        : `${failed} check${failed === 1 ? '' : 's'} unresolved`}
                    </span>
                    {fix.pullRequest ? <span>PR #{fix.pullRequest.number} · {fix.pullRequest.state}</span> : null}
                    <Link href={`/reasoning/${fix.investigationId}`} className="ms-auto hover:text-secondary">
                      Why the agent decided this →
                    </Link>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
