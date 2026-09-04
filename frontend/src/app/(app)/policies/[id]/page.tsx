'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Investigation, Policy } from '@/lib/types';
import {
  Button, DecisionBadge, EmptyState, PageHeader, Panel, PanelHeader, Skeleton,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const { data: policy, initial } = usePolling<Policy>(`policies/${params.id}`, 0);
  const { data: investigations } = usePolling<Investigation[]>('investigations', 0);

  if (initial) return <Skeleton className="h-[380px]" />;

  if (!policy) {
    return (
      <Panel>
        <EmptyState
          title="Policy not found"
          icon={<Icon.Policy size={18} />}
          action={<Link href="/policies"><Button>Back to policies</Button></Link>}
        />
      </Panel>
    );
  }

  // Investigations whose decision step cited this policy.
  const invoked = (investigations ?? []).filter((inv) =>
    inv.steps.some((s) => s.citations.some((c) => c.href === `/policies/${policy.id}`)),
  );

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-xs">
            <Link href="/policies" className="hover:text-tertiary">Policies</Link>
            <Icon.ChevronRight size={11} />
            <span className="font-mono">{policy.id.toUpperCase().replace(/_/g, '-')}</span>
          </span>
        }
        title={t(policy.name)}
        description={`${policy.category.replace('_', ' ')} · enforcement: ${policy.enforcement}`}
        actions={
          <span className={cn(
            'rounded-full border px-lg py-xs text-text-xs font-medium',
            policy.enabled
              ? 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary'
              : 'border-secondary bg-tertiary text-tertiary',
          )}>
            {policy.enabled ? 'Enabled' : 'Disabled'}
          </span>
        }
      />

      <div className="grid gap-xl lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-xl">
          <Panel>
            <PanelHeader title="Statement" description="The rule as a person reads it." />
            <div className="px-3xl py-xl">
              <p className="text-text-md leading-relaxed text-secondary">{t(policy.statement)}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Machine form"
              description="What the agent actually evaluates. Kept beside the prose so the two cannot drift apart unnoticed."
            />
            <pre className="scroll-thin overflow-x-auto px-3xl py-xl font-mono text-text-sm leading-relaxed text-tertiary">
              {policy.expression}
            </pre>
          </Panel>

          <Panel>
            <PanelHeader
              title="Decisions this policy shaped"
              description="Investigations whose decision step cited this rule."
            />
            {invoked.length === 0 ? (
              <EmptyState
                title="Not yet invoked"
                description="No investigation has cited this policy in its decision step."
                icon={<Icon.Policy size={18} />}
              />
            ) : (
              <ul className="divide-y divide-[color:var(--border-secondary)]">
                {invoked.map((inv) => (
                  <li key={inv.id}>
                    <Link href={`/reasoning/${inv.id}`} className="flex items-start gap-lg px-3xl py-lg transition-colors hover:bg-primary-hover">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-text-sm font-medium text-primary">{t(inv.title)}</p>
                        <p className="mt-xxs font-mono text-text-xs text-quaternary">
                          {inv.repo} · confidence {inv.confidence}% · {relativeTime(inv.startedAt)}
                        </p>
                      </div>
                      <DecisionBadge decision={inv.decision} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-xl lg:sticky lg:top-20">
          <Panel>
            <PanelHeader title="Status" dense />
            <dl className="space-y-lg px-xl py-lg text-text-sm">
              {[
                ['Enforcement', policy.enforcement],
                ['Violations', String(policy.violations)],
                ['Category', policy.category.replace('_', ' ')],
                ['Updated', relativeTime(policy.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-lg">
                  <dt className="text-quaternary">{k}</dt>
                  <dd className="font-mono text-text-xs capitalize text-secondary">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {policy.enforcement === 'block' ? (
            <Panel className="border-error">
              <div className="px-xl py-lg">
                <div className="flex items-start gap-lg">
                  <span className="mt-xxs shrink-0 text-error-primary"><Icon.Lock size={16} /></span>
                  <div>
                    <p className="text-text-sm font-semibold text-primary">This rule can veto the agent.</p>
                    <p className="mt-xs text-text-sm leading-relaxed text-tertiary">
                      A blocking policy is evaluated after confidence, and overrides it. Even a 99% confident
                      fix is held if this rule matches — which is what makes autonomy safe to grant at all.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
