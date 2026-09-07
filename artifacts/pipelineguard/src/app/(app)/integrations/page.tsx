import React from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import type { Integration } from '@/lib/types';
import {
  Button, PageHeader, Panel, PanelHeader, Skeleton, StatTile,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

const categoryLabels: Record<Integration['category'], string> = {
  scm: 'Source control',
  ci: 'CI / CD',
  cloud: 'Cloud',
  notify: 'Notifications',
};

const categoryIcon: Record<Integration['category'], React.ReactNode> = {
  scm: <Icon.Repo size={16} />,
  ci: <Icon.Pipeline size={16} />,
  cloud: <Icon.Layers size={16} />,
  notify: <Icon.Bell size={16} />,
};

export default function IntegrationsPage() {
  const { data, initial } = usePolling<Integration[]>('integrations', 30_000);
  const integrations = data ?? [];
  const connected = integrations.filter((i) => i.connected);
  const available = integrations.filter((i) => !i.connected);

  const grouped = (['scm', 'ci', 'cloud', 'notify'] as Integration['category'][])
    .map((c) => ({ category: c, items: connected.filter((i) => i.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Integrations"
        description="What PipelineGuard can see. Every scope here is a capability the agent may use — and the scopes it does not have are the reason some investigations end in a refusal."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Connected" value={connected.length} icon={<Icon.Plug size={15} />} />
        <StatTile label="Available" value={available.length} icon={<Icon.Layers size={15} />} />
        <StatTile label="Total scopes granted" value={connected.reduce((a, i) => a + i.scopes.length, 0)} icon={<Icon.Key size={15} />} />
      </div>

      {initial ? (
        <Skeleton className="h-[420px]" />
      ) : (
        <>
          {grouped.map((g) => (
            <Panel key={g.category} className="mb-xl">
              <PanelHeader
                title={
                  <span className="flex items-center gap-md">
                    <span className="text-quaternary">{categoryIcon[g.category]}</span>
                    {categoryLabels[g.category]}
                  </span>
                }
              />
              <ul className="divide-y divide-[color:var(--border-secondary)]">
                {g.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start gap-lg px-3xl py-xl">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-md">
                        <span className="text-text-sm font-semibold text-primary">{i.name}</span>
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary px-md py-xxs text-text-xs font-medium text-success-primary">
                          Connected
                        </span>
                      </div>
                      <p className="mt-xs text-text-sm text-tertiary">{i.detail}</p>
                      <div className="mt-md flex flex-wrap gap-xs">
                        {i.scopes.map((s) => (
                          <span key={s} className="rounded-md border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-tertiary">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-md">
                      <span className="font-mono text-text-xs text-quaternary">
                        {i.connectedAt ? relativeTime(i.connectedAt) : ''}
                      </span>
                      <Button size="sm" variant="secondary">Manage</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}

          <Panel className="mb-xl">
            <PanelHeader title="Available" description="Not yet connected." />
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {available.map((i) => (
                <li key={i.id} className="flex items-center gap-lg px-3xl py-lg">
                  <span className="shrink-0 text-quaternary">{categoryIcon[i.category]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-sm font-medium text-primary">{i.name}</p>
                    <p className="mt-xxs text-text-xs text-quaternary">{categoryLabels[i.category]}</p>
                  </div>
                  <Button size="sm" variant="secondary">Connect</Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="border-dashed">
            <PanelHeader
              title="Scopes the agent has asked for and not been granted"
              description="These gaps are visible in reasoning chains rather than hidden. PG-1044 ended in a refusal because of the first one."
            />
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {[
                ['organization_variables: read', 'Would let the agent resolve vars.WEBHOOK_URL and settle finding PG-1044 without escalating.', '/reasoning/inv_2a5d10'],
                ['environments: write', 'Would let the agent add approval gates directly instead of raising a review item.', '/findings/PG-1052'],
              ].map(([scope, note, href]) => (
                <li key={scope} className="flex items-start gap-lg px-3xl py-lg">
                  <span className="mt-xxs shrink-0 text-quaternary"><Icon.Lock size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-text-xs text-secondary">{scope}</p>
                    <p className="mt-xxs text-text-sm leading-relaxed text-tertiary">{note}</p>
                  </div>
                  <Link href={href} className="shrink-0 text-text-xs font-medium text-brand-secondary hover:underline">
                    See impact
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </>
  );
}
