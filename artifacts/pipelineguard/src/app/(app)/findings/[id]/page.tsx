import React from 'react';
import { Link } from 'wouter';
import { useParams } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Finding, Investigation } from '@/lib/types';
import {
  Button, DecisionBadge, EmptyState, PageHeader, Panel, PanelHeader, SeverityBadge,
  Skeleton, StatusBadge,
} from '@/components/ui/primitives';
import { PreventsCallout } from '@/components/fixes/fix-parts';
import { Icon } from '@/components/ui/icons';
import { formatDateTime, relativeTime } from '@/lib/utils';

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const { data: finding, initial } = usePolling<Finding>(`findings/${params.id}`, 0);
  const { data: inv } = usePolling<Investigation>(
    finding?.investigationId ? `investigations/${finding.investigationId}` : null, 0,
  );

  if (initial) {
    return (
      <>
        <Skeleton className="mb-3xl h-10 w-2/3" />
        <Skeleton className="h-[300px]" />
      </>
    );
  }

  if (!finding) {
    return (
      <Panel>
        <EmptyState
          title="Finding not found"
          icon={<Icon.Alert size={18} />}
          action={<Link href="/findings"><Button>Back to findings</Button></Link>}
        />
      </Panel>
    );
  }

  const timeline = [
    { at: finding.detectedAt, label: 'Detected by PipelineGuard', detail: finding.ruleId },
    ...(inv ? [{ at: inv.startedAt, label: 'Investigation opened', detail: inv.id }] : []),
    ...(inv ? [{
      at: new Date(Date.parse(inv.startedAt) + inv.durationMs).toISOString(),
      label: `Decision: ${inv.decision.replace('_', ' ')}`,
      detail: `confidence ${inv.confidence}%`,
    }] : []),
    ...(finding.resolvedAt ? [{ at: finding.resolvedAt, label: 'Resolved', detail: 'fix merged' }] : []),
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-xs">
            <Link href="/findings" className="hover:text-tertiary">Findings</Link>
            <Icon.ChevronRight size={11} />
            <span className="font-mono">{finding.id}</span>
          </span>
        }
        title={t(finding.title)}
        description={`${finding.repo} · ${finding.filePath}:${finding.line}`}
        actions={
          inv ? (
            <Link href={`/reasoning/${inv.id}`}>
              <Button variant="primary"><Icon.Brain size={13} /> See the reasoning</Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-xl flex flex-wrap items-center gap-md">
        <SeverityBadge severity={finding.severity} />
        <StatusBadge status={finding.status} />
        {inv ? <DecisionBadge decision={inv.decision} size="sm" /> : null}
        <span className="font-mono text-text-xs text-quaternary">{finding.ruleId}</span>
        {finding.cwe ? <span className="font-mono text-text-xs text-quaternary">{finding.cwe}</span> : null}
      </div>

      <div className="grid gap-xl lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-xl">
          <Panel>
            <PanelHeader title="What was found" />
            <div className="px-3xl py-xl">
              <p className="text-text-sm leading-relaxed text-secondary">{t(finding.description)}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Impact if left in place" />
            <div className="px-3xl py-xl">
              <p className="text-text-sm leading-relaxed text-secondary">{t(finding.impact)}</p>
            </div>
          </Panel>

          {inv?.fix ? <PreventsCallout fix={inv.fix} /> : null}

          <Panel>
            <PanelHeader title="Timeline" />
            <ol className="reasoning-rail relative px-3xl py-xl">
              {timeline.map((e, i) => (
                <li key={i} className="relative ps-5xl pb-xl last:pb-0">
                  <span className="absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-secondary bg-primary text-quaternary">
                    <Icon.Dot size={9} />
                  </span>
                  <p className="text-text-sm font-medium text-primary">{e.label}</p>
                  <p className="mt-xxs font-mono text-text-xs text-quaternary">
                    {formatDateTime(e.at)} · {e.detail}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-xl lg:sticky lg:top-20">
          <Panel>
            <PanelHeader title="Context" dense />
            <dl className="space-y-lg px-xl py-lg text-text-sm">
              {[
                ['Repository', finding.repo, `/repositories`],
                ['Pipeline', finding.pipelineName, `/pipelines/${finding.pipelineId}`],
                ['Job', finding.jobId ?? 'workflow level', null],
                ['File', `${finding.filePath}:${finding.line}`, null],
                ['Category', finding.category.replace('_', ' '), null],
                ['Detected', relativeTime(finding.detectedAt), null],
              ].map(([label, value, href]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-lg">
                  <dt className="shrink-0 text-quaternary">{label}</dt>
                  <dd className="truncate text-end font-mono text-text-xs text-secondary">
                    {href ? (
                      <Link href={href as string} className="hover:text-primary hover:underline">{value}</Link>
                    ) : value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          {inv ? (
            <Panel>
              <PanelHeader title="Agent decision" dense />
              <div className="px-xl py-lg">
                <DecisionBadge decision={inv.decision} />
                <p className="mt-lg text-text-sm leading-relaxed text-tertiary">
                  {t(inv.steps[inv.steps.length - 1].claim)}
                </p>
                <Link
                  href={`/reasoning/${inv.id}`}
                  className="mt-lg inline-flex items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline"
                >
                  Full reasoning chain <Icon.ArrowRight size={13} />
                </Link>
              </div>
            </Panel>
          ) : (
            <Panel className="border-dashed">
              <PanelHeader title="No investigation yet" dense />
              <p className="px-xl py-lg text-text-sm leading-relaxed text-tertiary">
                This finding was raised by a static policy check. The agent has not opened a reasoning
                investigation on it, so there is no decision to explain.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
