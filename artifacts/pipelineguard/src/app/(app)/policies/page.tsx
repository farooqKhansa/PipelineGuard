import React from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Policy } from '@/lib/types';
import { PageHeader, Panel, PanelHeader, Skeleton, StatTile } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

const enforcementMeta: Record<Policy['enforcement'], { label: string; cls: string }> = {
  block: { label: 'Blocks', cls: 'border-error bg-error-primary text-error-primary' },
  warn: { label: 'Warns', cls: 'border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary text-warning-primary' },
  audit: { label: 'Audits', cls: 'border-secondary bg-tertiary text-tertiary' },
};

export default function PoliciesPage() {
  const { t } = useLocale();
  const { data, initial } = usePolling<Policy[]>('policies', 30_000);
  const policies = data ?? [];

  const enabled = policies.filter((p) => p.enabled).length;
  const violations = policies.reduce((a, p) => a + p.violations, 0);
  const blocking = policies.filter((p) => p.enforcement === 'block' && p.enabled).length;

  return (
    <>
      <PageHeader
        title="Policies"
        description="The rules that bound what the agent may do. Confidence alone never authorises action — a policy can veto at any confidence, and two of these do."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Enabled" value={`${enabled} / ${policies.length}`} icon={<Icon.Policy size={15} />} />
        <StatTile label="Blocking rules" value={blocking} sub="Veto the agent regardless of confidence" icon={<Icon.Lock size={15} />} />
        <StatTile label="Violations" value={violations} tone={violations > 0 ? 'warn' : 'good'} sub="Across all monitored pipelines" icon={<Icon.Alert size={15} />} />
      </div>

      {initial ? (
        <Skeleton className="h-[420px]" />
      ) : (
        <div className="space-y-xl">
          {policies.map((p) => {
            const meta = enforcementMeta[p.enforcement];
            return (
              <Panel key={p.id} className={cn(!p.enabled && 'opacity-60')}>
                <PanelHeader
                  title={
                    <Link href={`/policies/${p.id}`} className="hover:underline">{t(p.name)}</Link>
                  }
                  description={`${p.id.toUpperCase().replace(/_/g, '-')} · ${p.category.replace('_', ' ')}`}
                  actions={
                    <>
                      <span className={cn('rounded-full border px-lg py-xs text-text-xs font-medium', meta.cls)}>
                        {meta.label}
                      </span>
                      <span className={cn(
                        'rounded-full border px-lg py-xs text-text-xs font-medium',
                        p.enabled
                          ? 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary'
                          : 'border-secondary bg-tertiary text-tertiary',
                      )}>
                        {p.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </>
                  }
                />
                <div className="px-3xl py-xl">
                  <p className="max-w-paragraph text-text-sm leading-relaxed text-secondary">{t(p.statement)}</p>
                  <pre className="scroll-thin mt-lg overflow-x-auto rounded-md border border-secondary bg-secondary px-lg py-md font-mono text-text-xs text-tertiary">
                    {p.expression}
                  </pre>
                  <div className="mt-lg flex flex-wrap items-center gap-xl font-mono text-text-xs text-quaternary">
                    <span className={p.violations > 0 ? 'text-warning-primary' : undefined}>
                      {p.violations} violation{p.violations === 1 ? '' : 's'}
                    </span>
                    <span>updated {relativeTime(p.updatedAt)}</span>
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
