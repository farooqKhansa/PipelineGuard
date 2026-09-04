'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Finding, Pipeline, PipelineRun } from '@/lib/types';
import {
  Panel, PanelHeader, SeverityBadge, Skeleton, StatTile, StatusBadge, Table, Td, Th, Tr,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, formatDuration, relativeTime } from '@/lib/utils';

export default function PipelineOverviewPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const { data: pipeline, initial } = usePolling<Pipeline>(`pipelines/${params.id}`, 0);
  const { data: runs } = usePolling<PipelineRun[]>(`pipelines/${params.id}/runs`, 0);
  const { data: allFindings } = usePolling<Finding[]>('findings', 0);

  if (initial || !pipeline) return <Skeleton className="h-[420px]" />;

  const findings = (allFindings ?? []).filter((f) => f.pipelineId === pipeline.id);

  return (
    <>
      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Health score" value={pipeline.healthScore} tone={pipeline.healthScore >= 80 ? 'good' : pipeline.healthScore >= 60 ? 'warn' : 'critical'} icon={<Icon.Activity size={15} />} />
        <StatTile label="Pass rate" value={`${pipeline.passRate}%`} sub="Last 30 runs" icon={<Icon.Check size={15} />} />
        <StatTile label="Open findings" value={pipeline.openFindings} tone={pipeline.openFindings > 0 ? 'warn' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Jobs" value={pipeline.jobs.length} sub={`${pipeline.secretsUsed.length} secrets in scope`} icon={<Icon.Pipeline size={15} />} />
      </div>

      <div className="grid gap-xl lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-xl">
          <Panel>
            <PanelHeader
              title="Jobs"
              description="Effective permissions after workflow and job blocks are merged."
              actions={
                <Link href={`/pipelines/${pipeline.id}/graph`} className="text-text-xs font-medium text-brand-secondary hover:underline">
                  See as graph
                </Link>
              }
            />
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {pipeline.jobs.map((job) => {
                const writes = Object.entries(job.permissions).filter(([, v]) => v === 'write');
                return (
                  <li key={job.id} className="px-3xl py-lg">
                    <div className="flex flex-wrap items-center gap-md">
                      <span className="font-mono text-text-sm font-medium text-primary">{job.name}</span>
                      {job.environment ? (
                        <span className="rounded-full border border-error px-md py-xxs text-text-xs font-medium text-error-primary">
                          {job.environment}
                        </span>
                      ) : null}
                      {job.findingIds.length > 0 ? (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--sev-medium)_30%,transparent)] bg-warning-primary px-md py-xxs text-text-xs font-medium text-warning-primary">
                          {job.findingIds.length} finding{job.findingIds.length === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      <span className="tnum ms-auto font-mono text-text-xs text-quaternary">
                        {job.steps} steps · {formatDuration(job.avgDurationMs)}
                      </span>
                    </div>

                    <div className="mt-md flex flex-wrap gap-xs">
                      {Object.entries(job.permissions).map(([scope, level]) => (
                        <span
                          key={scope}
                          className={cn(
                            'rounded-md border px-md py-xxs font-mono text-text-xs',
                            level === 'write'
                              ? 'border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary text-warning-primary'
                              : 'border-secondary bg-tertiary text-tertiary',
                          )}
                        >
                          {scope}: {level}
                        </span>
                      ))}
                      {job.needs.length > 0 ? (
                        <span className="rounded-md border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-quaternary">
                          needs {job.needs.join(', ')}
                        </span>
                      ) : null}
                    </div>

                    {writes.length > 2 ? (
                      <p className="mt-md text-text-xs leading-relaxed text-warning-primary">
                        {writes.length} write scopes on a single job. Each one widens what a compromised step
                        in this job can reach.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader
              title="Recent runs"
              actions={
                <Link href={`/pipelines/${pipeline.id}/runs`} className="text-text-xs font-medium text-brand-secondary hover:underline">
                  Full history
                </Link>
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>Run</Th>
                  <Th>Commit</Th>
                  <Th className="text-end">Risk</Th>
                  <Th className="text-end">When</Th>
                </tr>
              </thead>
              <tbody>
                {(runs ?? []).slice(0, 6).map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Link href={`/pipelines/${pipeline.id}/runs/${r.id}`} className="flex items-center gap-md">
                        <span className={r.status === 'passed' ? 'text-success-primary' : r.status === 'failed' ? 'text-error-primary' : 'text-quaternary'}>
                          {r.status === 'passed' ? <Icon.Check size={13} /> : <Icon.X size={13} />}
                        </span>
                        <span className="font-mono text-text-xs">#{r.number}</span>
                      </Link>
                    </Td>
                    <Td className="max-w-[240px]">
                      <span className="block truncate text-text-xs text-secondary">{r.commitMessage}</span>
                      <span className="block font-mono text-text-xs text-quaternary">{r.commit} · {r.author}</span>
                    </Td>
                    <Td className="tnum text-end font-mono text-text-xs">{r.riskScore}</Td>
                    <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(r.startedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>

        <div className="space-y-xl lg:sticky lg:top-20">
          <Panel>
            <PanelHeader title="Open findings" dense />
            {findings.length === 0 ? (
              <p className="px-xl py-lg text-text-sm text-tertiary">No findings on this pipeline.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-secondary)]">
                {findings.map((f) => (
                  <li key={f.id}>
                    <Link href={`/findings/${f.id}`} className="block px-xl py-lg transition-colors hover:bg-primary-hover">
                      <div className="flex items-center gap-md">
                        <span className="font-mono text-text-xs text-quaternary">{f.id}</span>
                        <SeverityBadge severity={f.severity} />
                        <StatusBadge status={f.status} />
                      </div>
                      <p className="mt-xs text-text-sm text-secondary">{t(f.title)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Environments & secrets" dense />
            <div className="space-y-lg px-xl py-lg">
              <div>
                <p className="text-text-xs uppercase tracking-wide text-quaternary">Environments</p>
                <div className="mt-md flex flex-wrap gap-xs">
                  {pipeline.environments.length === 0 ? (
                    <span className="text-text-sm text-tertiary">None bound</span>
                  ) : pipeline.environments.map((e) => (
                    <span key={e} className="rounded-md border border-error bg-error-primary px-md py-xxs font-mono text-text-xs text-error-primary">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-text-xs uppercase tracking-wide text-quaternary">Secrets in scope</p>
                <div className="mt-md flex flex-wrap gap-xs">
                  {pipeline.secretsUsed.map((s) => (
                    <span key={s} className="rounded-md border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-tertiary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
