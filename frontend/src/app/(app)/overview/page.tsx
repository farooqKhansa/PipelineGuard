'use client';

import React from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { AgentActivity, Finding, PipelineRun, TrendPoint, AgentStats } from '@/lib/types';
import {
  DecisionBadge, EmptyState, PageHeader, Panel, PanelHeader, SeverityBadge,
  Skeleton, StatTile, StatusBadge, Table, Td, Th, Tr,
} from '@/components/ui/primitives';
import { DecisionSplitBar, RiskTrendChart } from '@/components/charts/trend-charts';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

interface Overview {
  stats: AgentStats;
  openFindings: number;
  criticalFindings: number;
  monitoredRepos: number;
  monitoredPipelines: number;
  pendingReviews: number;
  unreadAlerts: number;
  meanRisk: number;
  riskDelta: number;
  recentRuns: PipelineRun[];
  recentActivity: AgentActivity[];
  recentFindings: Finding[];
  trends: TrendPoint[];
}

const runStatusStyles: Record<PipelineRun['status'], string> = {
  passed: 'text-success-primary',
  failed: 'text-error-primary',
  running: 'text-warning-primary',
  cancelled: 'text-quaternary',
};

export default function OverviewPage() {
  const { t } = useLocale();
  // 15s polling: fast enough that a judge sees the timestamp move, slow enough
  // that it does not hammer the gateway during a demo.
  const { data, initial } = usePolling<Overview>('overview', 15_000);

  if (initial || !data) {
    return (
      <>
        <PageHeader title="Security overview" description="Loading pipeline posture across the organisation." />
        <div className="grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)}
        </div>
        <Skeleton className="mt-xl h-[380px]" />
      </>
    );
  }

  const s = data.stats;

  return (
    <>
      <PageHeader
        title="Security overview"
        description="Configuration risk across every monitored pipeline, and what the agent did about it."
        actions={
          <Link
            href="/demo"
            className="inline-flex items-center gap-md rounded-md bg-brand-solid px-xl py-md text-text-sm font-medium text-white transition-colors hover:bg-brand-solid-hover"
          >
            <Icon.Play size={14} />
            Run the three-outcome demo
          </Link>
        }
      />

      <div className="grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Mean config risk"
          value={data.meanRisk}
          delta={{ value: `${data.riskDelta}`, good: data.riskDelta < 0 }}
          sub="Across 14 days. Lower is better."
          tone={data.meanRisk > 60 ? 'critical' : data.meanRisk > 35 ? 'warn' : 'good'}
          icon={<Icon.Radar size={15} />}
          href="/trends"
        />
        <StatTile
          label="Open findings"
          value={data.openFindings}
          sub={`${data.criticalFindings} critical awaiting action`}
          tone={data.criticalFindings > 0 ? 'critical' : 'neutral'}
          icon={<Icon.Alert size={15} />}
          href="/findings"
        />
        <StatTile
          label="Pending reviews"
          value={data.pendingReviews}
          sub="Fixes the agent drafted but held"
          tone={data.pendingReviews > 0 ? 'warn' : 'neutral'}
          icon={<Icon.Inbox size={15} />}
          href="/reviews"
        />
        <StatTile
          label="Monitored"
          value={`${data.monitoredRepos} / ${data.monitoredPipelines}`}
          sub="Repositories / pipelines"
          icon={<Icon.Repo size={15} />}
          href="/repositories"
        />
      </div>

      <div className="mt-xl grid gap-xl lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <PanelHeader
            title="Pipeline health over 14 days"
            description="Mean configuration risk per day, annotated with what changed."
            actions={
              <Link href="/trends" className="text-text-xs font-medium text-brand-secondary hover:underline">
                All trends
              </Link>
            }
          />
          <div className="px-3xl py-xl">
            <RiskTrendChart data={data.trends} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="How the agent decided"
            description={`${s.totalDecisions} decisions in the window.`}
          />
          <div className="px-3xl py-xl">
            <DecisionSplitBar autoFixed={s.autoFixed} flagged={s.flagged} refused={s.refused} />

            <dl className="mt-3xl grid grid-cols-2 gap-x-xl gap-y-lg border-t border-secondary pt-xl">
              <div>
                <dt className="text-text-xs uppercase tracking-wide text-quaternary">Fix success</dt>
                <dd className="tnum mt-xxs text-text-lg font-semibold text-primary">{s.fixSuccessRate}%</dd>
              </div>
              <div>
                <dt className="text-text-xs uppercase tracking-wide text-quaternary">Flag agreement</dt>
                <dd className="tnum mt-xxs text-text-lg font-semibold text-primary">{s.flagAgreementRate}%</dd>
              </div>
              <div>
                <dt className="text-text-xs uppercase tracking-wide text-quaternary" title="Of refusals, how many a human later confirmed were genuinely ambiguous.">
                  Refusal vindicated
                </dt>
                <dd className="tnum mt-xxs text-text-lg font-semibold text-primary">{s.refusalVindicationRate}%</dd>
              </div>
              <div>
                <dt className="text-text-xs uppercase tracking-wide text-quaternary">Wrong auto-fixes</dt>
                <dd className={cn('tnum mt-xxs text-text-lg font-semibold', s.falseAutoFixes > 0 ? 'text-error-primary' : 'text-success-primary')}>
                  {s.falseAutoFixes}
                </dd>
              </div>
            </dl>
            <p className="mt-lg text-text-xs leading-relaxed text-tertiary">
              Wrong auto-fixes is published deliberately. A tool that reports only its wins is not a tool a
              security team can calibrate against.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-xl grid gap-xl lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Recent agent actions"
            actions={<Link href="/reasoning" className="text-text-xs font-medium text-brand-secondary hover:underline">Reasoning center</Link>}
          />
          {data.recentActivity.length === 0 ? (
            <EmptyState title="No agent activity yet" icon={<Icon.Brain size={18} />} />
          ) : (
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {data.recentActivity.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/reasoning/${a.investigationId}`}
                    className="flex items-start gap-lg px-3xl py-lg transition-colors hover:bg-primary-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-text-sm font-medium text-primary">{t(a.title)}</p>
                      <p className="mt-xxs truncate font-mono text-text-xs text-quaternary">
                        {a.repo} · {relativeTime(a.at)} · confidence {a.confidence}%
                      </p>
                    </div>
                    <DecisionBadge decision={a.decision} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Recent pipeline runs"
            actions={<Link href="/pipelines" className="text-text-xs font-medium text-brand-secondary hover:underline">All pipelines</Link>}
          />
          <Table>
            <thead>
              <tr>
                <Th>Run</Th>
                <Th>Pipeline</Th>
                <Th className="text-end">Risk</Th>
                <Th className="text-end">When</Th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link href={`/pipelines/${r.pipelineId}/runs/${r.id}`} className="flex items-center gap-md">
                      <span className={runStatusStyles[r.status]}>
                        {r.status === 'passed' ? <Icon.Check size={13} /> : r.status === 'failed' ? <Icon.X size={13} /> : <Icon.Clock size={13} />}
                      </span>
                      <span className="font-mono text-text-xs text-secondary">#{r.number}</span>
                    </Link>
                  </Td>
                  <Td className="max-w-[160px] truncate text-text-xs">{r.pipelineName}</Td>
                  <Td className="text-end">
                    <span className={cn('tnum font-mono text-text-xs', r.riskScore > 60 ? 'text-error-primary' : r.riskScore > 35 ? 'text-warning-primary' : 'text-tertiary')}>
                      {r.riskScore}
                    </span>
                  </Td>
                  <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(r.startedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>

      <Panel className="mt-xl">
        <PanelHeader
          title="Recent security findings"
          actions={<Link href="/findings" className="text-text-xs font-medium text-brand-secondary hover:underline">All findings</Link>}
        />
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Finding</Th>
              <Th>Severity</Th>
              <Th>Status</Th>
              <Th>Pipeline</Th>
              <Th className="text-end">Detected</Th>
            </tr>
          </thead>
          <tbody>
            {data.recentFindings.map((f) => (
              <Tr key={f.id}>
                <Td className="font-mono text-text-xs text-quaternary">
                  <Link href={`/findings/${f.id}`} className="hover:text-secondary">{f.id}</Link>
                </Td>
                <Td className="max-w-[320px]">
                  <Link href={`/findings/${f.id}`} className="block truncate font-medium text-primary hover:underline">
                    {t(f.title)}
                  </Link>
                </Td>
                <Td><SeverityBadge severity={f.severity} /></Td>
                <Td><StatusBadge status={f.status} /></Td>
                <Td className="text-text-xs text-tertiary">{f.pipelineName}</Td>
                <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(f.detectedAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
