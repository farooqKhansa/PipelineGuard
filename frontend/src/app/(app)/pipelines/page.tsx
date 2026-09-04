'use client';

import React from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import type { Pipeline } from '@/lib/types';
import { PageHeader, Panel, Skeleton, StatTile, Table, Td, Th, Tr } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

const providerLabels: Record<Pipeline['provider'], string> = {
  github_actions: 'GitHub Actions',
  gitlab_ci: 'GitLab CI',
  jenkins: 'Jenkins',
  azure_devops: 'Azure DevOps',
};

function HealthBar({ score }: { score: number }) {
  const tone = score >= 80 ? 'var(--fg-success-primary)' : score >= 60 ? 'var(--sev-medium)' : 'var(--fg-error-primary)';
  return (
    <div className="flex items-center gap-md">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-quaternary">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: tone }} />
      </div>
      <span className="tnum font-mono text-text-xs text-tertiary">{score}</span>
    </div>
  );
}

export default function PipelinesPage() {
  const { data, initial } = usePolling<Pipeline[]>('pipelines', 20_000);
  const pipelines = data ?? [];

  const prod = pipelines.filter((p) => p.touchesProduction).length;
  const findings = pipelines.reduce((a, p) => a + p.openFindings, 0);
  const avgPass = pipelines.length
    ? (pipelines.reduce((a, p) => a + p.passRate, 0) / pipelines.length).toFixed(1)
    : '—';

  return (
    <>
      <PageHeader
        title="Pipelines"
        description="Every workflow PipelineGuard watches. Production-bound pipelines are held to stricter autonomy rules."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Monitored" value={pipelines.length} icon={<Icon.Pipeline size={15} />} />
        <StatTile label="Touch production" value={prod} sub="Autonomous permission changes blocked" tone="warn" icon={<Icon.Lock size={15} />} />
        <StatTile label="Open findings" value={findings} tone={findings > 0 ? 'warn' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Mean pass rate" value={`${avgPass}%`} icon={<Icon.Activity size={15} />} />
      </div>

      <Panel>
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-64" /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Pipeline</Th>
                <Th>Provider</Th>
                <Th>Jobs</Th>
                <Th>Findings</Th>
                <Th>Pass rate</Th>
                <Th>Health</Th>
                <Th className="text-end">Last run</Th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => (
                <Tr key={p.id}>
                  <Td className="max-w-[280px]">
                    <Link href={`/pipelines/${p.id}`} className="flex items-center gap-md">
                      <span className="min-w-0">
                        <span className="flex items-center gap-md">
                          <span className="truncate font-medium text-primary hover:underline">{p.name}</span>
                          {p.touchesProduction ? (
                            <span className="shrink-0 rounded-full border border-error px-md py-xxs text-text-xs font-medium text-error-primary">
                              production
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-xxs block truncate font-mono text-text-xs text-quaternary">
                          {p.repo} · {p.filePath}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-text-xs text-tertiary">{providerLabels[p.provider]}</Td>
                  <Td className="tnum font-mono text-text-xs">{p.jobs.length}</Td>
                  <Td>
                    <span className={cn('tnum font-mono text-text-xs', p.openFindings > 0 ? 'text-warning-primary' : 'text-tertiary')}>
                      {p.openFindings}
                    </span>
                  </Td>
                  <Td className="tnum font-mono text-text-xs">{p.passRate}%</Td>
                  <Td><HealthBar score={p.healthScore} /></Td>
                  <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(p.lastRun)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
