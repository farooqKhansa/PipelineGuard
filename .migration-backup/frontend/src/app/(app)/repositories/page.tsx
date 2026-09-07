'use client';

import React from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import type { Repository } from '@/lib/types';
import { PageHeader, Panel, Skeleton, StatTile, Table, Td, Th, Tr } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

export default function RepositoriesPage() {
  const { data, initial } = usePolling<Repository[]>('repositories', 30_000);
  const repos = data ?? [];

  const monitored = repos.filter((r) => r.monitored).length;
  const critical = repos.reduce((a, r) => a + r.criticalFindings, 0);
  const open = repos.reduce((a, r) => a + r.openFindings, 0);

  return (
    <>
      <PageHeader
        title="Repositories"
        description="Every repository connected to PipelineGuard, ranked by how much attention its pipelines need."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Connected" value={repos.length} icon={<Icon.Repo size={15} />} />
        <StatTile label="Monitored" value={monitored} sub={`${repos.length - monitored} not yet enabled`} icon={<Icon.ShieldCheck size={15} />} />
        <StatTile label="Open findings" value={open} tone={open > 0 ? 'warn' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Critical" value={critical} tone={critical > 0 ? 'critical' : 'good'} icon={<Icon.Shield size={15} />} />
      </div>

      <Panel>
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-64" /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Repository</Th>
                <Th>Language</Th>
                <Th className="text-end">Pipelines</Th>
                <Th className="text-end">Findings</Th>
                <Th>Health</Th>
                <Th>Monitoring</Th>
                <Th className="text-end">Last activity</Th>
              </tr>
            </thead>
            <tbody>
              {[...repos].sort((a, b) => a.healthScore - b.healthScore).map((r) => (
                <Tr key={r.id}>
                  <Td className="max-w-[280px]">
                    <Link href={`/repositories/${r.id}`} className="block">
                      <span className="flex items-center gap-md">
                        <Icon.Repo size={13} className="shrink-0 text-quaternary" />
                        <span className="truncate font-medium text-primary hover:underline">{r.name}</span>
                        {r.private ? <Icon.Lock size={11} className="shrink-0 text-quaternary" /> : null}
                      </span>
                      <span className="mt-xxs block truncate font-mono text-text-xs text-quaternary">{r.fullName}</span>
                    </Link>
                  </Td>
                  <Td className="text-text-xs text-tertiary">{r.language}</Td>
                  <Td className="tnum text-end font-mono text-text-xs">{r.pipelineCount}</Td>
                  <Td className="text-end">
                    <span className={cn('tnum font-mono text-text-xs', r.criticalFindings > 0 ? 'text-error-primary' : r.openFindings > 0 ? 'text-warning-primary' : 'text-tertiary')}>
                      {r.openFindings}
                      {r.criticalFindings > 0 ? ` (${r.criticalFindings} critical)` : ''}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-md">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-quaternary">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${r.healthScore}%`,
                            background: r.healthScore >= 80 ? 'var(--fg-success-primary)' : r.healthScore >= 60 ? 'var(--sev-medium)' : 'var(--fg-error-primary)',
                          }}
                        />
                      </div>
                      <span className="tnum font-mono text-text-xs text-tertiary">{r.healthScore}</span>
                    </div>
                  </Td>
                  <Td>
                    <span className={cn('text-text-xs font-medium', r.monitored ? 'text-success-primary' : 'text-quaternary')}>
                      {r.monitored ? 'Active' : 'Paused'}
                    </span>
                  </Td>
                  <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(r.lastActivity)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
