import React from 'react';
import { Link } from 'wouter';
import { useParams } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Finding, Pipeline, PipelineRun, Repository } from '@/lib/types';
import {
  Button, EmptyState, PageHeader, Panel, PanelHeader, SeverityBadge, Skeleton,
  StatTile, StatusBadge, Table, Td, Th, Tr,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime, severityRank } from '@/lib/utils';

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const { data: repo, initial } = usePolling<Repository>(`repositories/${params.id}`, 0);
  const { data: allPipelines } = usePolling<Pipeline[]>('pipelines', 0);
  const { data: allFindings } = usePolling<Finding[]>('findings', 0);
  const { data: allRuns } = usePolling<PipelineRun[]>('runs', 0);

  if (initial) return <Skeleton className="h-[420px]" />;

  if (!repo) {
    return (
      <Panel>
        <EmptyState
          title="Repository not found"
          icon={<Icon.Repo size={18} />}
          action={<Link href="/repositories"><Button>Back to repositories</Button></Link>}
        />
      </Panel>
    );
  }

  const pipelines = (allPipelines ?? []).filter((p) => p.repo === repo.fullName);
  const findings = (allFindings ?? [])
    .filter((f) => f.repo === repo.fullName)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const runs = (allRuns ?? []).filter((r) => r.repo === repo.fullName).slice(0, 8);

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-xs">
            <Link href="/repositories" className="hover:text-tertiary">Repositories</Link>
            <Icon.ChevronRight size={11} />
            <span className="font-mono">{repo.name}</span>
          </span>
        }
        title={repo.fullName}
        description={`${repo.language} · default branch ${repo.defaultBranch} · ${repo.private ? 'private' : 'public'}`}
        actions={
          <span className={cn(
            'rounded-full border px-lg py-xs text-text-xs font-medium',
            repo.monitored
              ? 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary'
              : 'border-secondary bg-tertiary text-tertiary',
          )}>
            {repo.monitored ? 'Monitoring active' : 'Monitoring paused'}
          </span>
        }
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Health score" value={repo.healthScore} tone={repo.healthScore >= 80 ? 'good' : repo.healthScore >= 60 ? 'warn' : 'critical'} icon={<Icon.Activity size={15} />} />
        <StatTile label="Pipelines" value={pipelines.length} icon={<Icon.Pipeline size={15} />} />
        <StatTile label="Open findings" value={repo.openFindings} tone={repo.openFindings > 0 ? 'warn' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Critical" value={repo.criticalFindings} tone={repo.criticalFindings > 0 ? 'critical' : 'good'} icon={<Icon.Shield size={15} />} />
      </div>

      <div className="grid gap-xl lg:grid-cols-2 lg:items-start">
        <Panel>
          <PanelHeader title="Pipelines" />
          {pipelines.length === 0 ? (
            <EmptyState title="No pipelines detected" icon={<Icon.Pipeline size={18} />} />
          ) : (
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {pipelines.map((p) => (
                <li key={p.id}>
                  <Link href={`/pipelines/${p.id}`} className="flex items-center gap-lg px-3xl py-lg transition-colors hover:bg-primary-hover">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-md">
                        <span className="truncate text-text-sm font-medium text-primary">{p.name}</span>
                        {p.touchesProduction ? (
                          <span className="shrink-0 rounded-full border border-error px-md py-xxs text-text-xs text-error-primary">
                            production
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-xxs truncate font-mono text-text-xs text-quaternary">{p.filePath}</p>
                    </div>
                    <span className="tnum shrink-0 font-mono text-text-xs text-tertiary">{p.passRate}%</span>
                    <span className={cn('tnum shrink-0 font-mono text-text-xs', p.openFindings > 0 ? 'text-warning-primary' : 'text-quaternary')}>
                      {p.openFindings} findings
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Findings" actions={<Link href="/findings" className="text-text-xs font-medium text-brand-secondary hover:underline">All findings</Link>} />
          {findings.length === 0 ? (
            <EmptyState title="No findings on this repository" icon={<Icon.Check size={18} />} />
          ) : (
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {findings.map((f) => (
                <li key={f.id}>
                  <Link href={`/findings/${f.id}`} className="block px-3xl py-lg transition-colors hover:bg-primary-hover">
                    <div className="flex flex-wrap items-center gap-md">
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
      </div>

      <Panel className="mt-xl">
        <PanelHeader title="Recent activity" description="Runs across every pipeline in this repository." />
        <Table>
          <thead>
            <tr>
              <Th>Run</Th>
              <Th>Pipeline</Th>
              <Th>Commit</Th>
              <Th className="text-end">Risk</Th>
              <Th className="text-end">When</Th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Link href={`/pipelines/${r.pipelineId}/runs/${r.id}`} className="flex items-center gap-md">
                    <span className={r.status === 'passed' ? 'text-success-primary' : 'text-error-primary'}>
                      {r.status === 'passed' ? <Icon.Check size={13} /> : <Icon.X size={13} />}
                    </span>
                    <span className="font-mono text-text-xs hover:underline">#{r.number}</span>
                  </Link>
                </Td>
                <Td className="text-text-xs text-tertiary">{r.pipelineName}</Td>
                <Td className="max-w-[260px]">
                  <span className="block truncate text-text-xs text-secondary">{r.commitMessage}</span>
                  <span className="block font-mono text-text-xs text-quaternary">{r.commit}</span>
                </Td>
                <Td className="tnum text-end font-mono text-text-xs">{r.riskScore}</Td>
                <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(r.startedAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
