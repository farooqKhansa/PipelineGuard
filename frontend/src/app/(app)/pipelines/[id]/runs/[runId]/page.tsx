'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Finding, Investigation, Pipeline, PipelineRun } from '@/lib/types';
import {
  Button, DecisionBadge, EmptyState, Panel, PanelHeader, SeverityBadge, Skeleton, StatTile,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, formatDateTime, formatDuration } from '@/lib/utils';

export default function RunDetailPage() {
  const params = useParams<{ id: string; runId: string }>();
  const { t } = useLocale();
  const { data: run, initial } = usePolling<PipelineRun>(`runs/${params.runId}`, 0);
  const { data: pipeline } = usePolling<Pipeline>(`pipelines/${params.id}`, 0);
  const { data: investigations } = usePolling<Investigation[]>('investigations', 0);
  const { data: allFindings } = usePolling<Finding[]>('findings', 0);

  if (initial) return <Skeleton className="h-[420px]" />;

  if (!run) {
    return (
      <Panel>
        <EmptyState
          title="Run not found"
          icon={<Icon.History size={18} />}
          action={<Link href={`/pipelines/${params.id}/runs`}><Button>Back to run history</Button></Link>}
        />
      </Panel>
    );
  }

  const findings = (allFindings ?? []).filter((f) => run.findingIds.includes(f.id));
  const invs = (investigations ?? []).filter((i) => i.runId === run.id);

  return (
    <>
      <div className="mb-xl flex flex-wrap items-center gap-md">
        <Link href={`/pipelines/${params.id}/runs`} className="text-text-sm text-quaternary hover:text-tertiary">
          Run history
        </Link>
        <Icon.ChevronRight size={11} className="text-quaternary" />
        <span className="font-mono text-text-sm font-medium text-primary">Run #{run.number}</span>
        <span
          className={cn(
            'rounded-full border px-lg py-xs text-text-xs font-medium capitalize',
            run.status === 'passed'
              ? 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary'
              : 'border-error bg-error-primary text-error-primary',
          )}
        >
          {run.status}
        </span>
      </div>

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Config risk"
          value={run.riskScore}
          tone={run.riskScore > 60 ? 'critical' : run.riskScore > 35 ? 'warn' : 'good'}
          sub="Risk of the pipeline definition, not the code"
          icon={<Icon.Radar size={15} />}
        />
        <StatTile label="Duration" value={formatDuration(run.durationMs)} icon={<Icon.Clock size={15} />} />
        <StatTile label="Findings raised" value={run.findingIds.length} tone={run.findingIds.length > 0 ? 'warn' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Agent decisions" value={run.decisions.length} icon={<Icon.Brain size={15} />} />
      </div>

      <div className="grid gap-xl lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-xl">
          <Panel>
            <PanelHeader title="Job timeline" description="Sequential view of the run, ordered by dependency." />
            <ol className="reasoning-rail relative px-3xl py-xl">
              {(pipeline?.jobs ?? []).map((job) => {
                const jobFindings = findings.filter((f) => f.jobId === job.id);
                return (
                  <li key={job.id} className="relative ps-5xl pb-xl last:pb-0">
                    <span
                      className={cn(
                        'absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-primary',
                        jobFindings.length > 0
                          ? 'border-[color-mix(in_srgb,var(--sev-medium)_40%,transparent)] text-warning-primary'
                          : 'border-secondary text-success-primary',
                      )}
                    >
                      {jobFindings.length > 0 ? <Icon.Alert size={13} /> : <Icon.Check size={13} />}
                    </span>
                    <div className="flex flex-wrap items-center gap-md">
                      <span className="font-mono text-text-sm font-medium text-primary">{job.name}</span>
                      {job.environment ? (
                        <span className="rounded-full border border-error px-md py-xxs text-text-xs text-error-primary">
                          {job.environment}
                        </span>
                      ) : null}
                      <span className="tnum ms-auto font-mono text-text-xs text-quaternary">
                        {formatDuration(job.avgDurationMs)}
                      </span>
                    </div>
                    {job.needs.length > 0 ? (
                      <p className="mt-xxs font-mono text-text-xs text-quaternary">needs {job.needs.join(', ')}</p>
                    ) : null}
                    {jobFindings.map((f) => (
                      <Link
                        key={f.id}
                        href={`/findings/${f.id}`}
                        className="mt-md flex flex-wrap items-center gap-md rounded-md border border-secondary bg-secondary px-lg py-md transition-colors hover:border-primary"
                      >
                        <SeverityBadge severity={f.severity} />
                        <span className="text-text-sm text-secondary">{t(f.title)}</span>
                      </Link>
                    ))}
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        <div className="space-y-xl lg:sticky lg:top-20">
          <Panel>
            <PanelHeader title="Commit" dense />
            <div className="space-y-lg px-xl py-lg">
              <p className="text-text-sm text-secondary">{run.commitMessage}</p>
              <dl className="space-y-md text-text-sm">
                {[
                  ['SHA', run.commit],
                  ['Author', run.author],
                  ['Branch', run.branch],
                  ['Started', formatDateTime(run.startedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-lg">
                    <dt className="text-quaternary">{k}</dt>
                    <dd className="font-mono text-text-xs text-secondary">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>

          {invs.length > 0 ? (
            <Panel>
              <PanelHeader title="Agent investigations" dense />
              <ul className="divide-y divide-[color:var(--border-secondary)]">
                {invs.map((inv) => (
                  <li key={inv.id}>
                    <Link href={`/reasoning/${inv.id}`} className="block px-xl py-lg transition-colors hover:bg-primary-hover">
                      <DecisionBadge decision={inv.decision} size="sm" />
                      <p className="mt-md text-text-sm font-medium text-primary">{t(inv.title)}</p>
                      <p className="mt-xxs font-mono text-text-xs text-quaternary">
                        confidence {inv.confidence}% · {inv.steps.length} steps
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
