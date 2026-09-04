'use client';

import React from 'react';
import Link from 'next/link';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { AgentActivity, AgentStats, TrendPoint } from '@/lib/types';
import {
  DecisionBadge, PageHeader, Panel, PanelHeader, Skeleton, StatTile,
} from '@/components/ui/primitives';
import { DecisionMixChart, DecisionSplitBar } from '@/components/charts/trend-charts';
import { Icon } from '@/components/ui/icons';
import { cn, formatDuration, relativeTime } from '@/lib/utils';

interface AgentPayload { stats: AgentStats; activity: AgentActivity[] }

export default function AgentControlPage() {
  const { t } = useLocale();
  const { data, initial } = usePolling<AgentPayload>('agent', 20_000);
  const { data: trends } = usePolling<TrendPoint[]>('trends', 0);

  if (initial || !data) {
    return (
      <>
        <PageHeader title="Agent control center" description="Loading agent telemetry." />
        <Skeleton className="h-[420px]" />
      </>
    );
  }

  const s = data.stats;

  return (
    <>
      <PageHeader
        title="Agent control center"
        description="What the agent is allowed to do, what it actually did, and how often it was right — including the times it was not."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Decisions" value={s.totalDecisions} sub="In the reporting window" icon={<Icon.Brain size={15} />} />
        <StatTile label="Mean confidence" value={`${s.meanConfidence}%`} sub="Across all decisions" icon={<Icon.Activity size={15} />} />
        <StatTile label="Mean investigation" value={formatDuration(s.meanInvestigationMs)} sub="Detection to decision" icon={<Icon.Clock size={15} />} />
        <StatTile
          label="Wrong auto-fixes"
          value={s.falseAutoFixes}
          sub="Applied, later found incorrect"
          tone={s.falseAutoFixes > 0 ? 'critical' : 'good'}
          icon={<Icon.Alert size={15} />}
        />
      </div>

      <div className="mb-xl grid gap-xl lg:grid-cols-[1fr_1.4fr]">
        <Panel>
          <PanelHeader title="Decision split" description="The three outcomes, by volume." />
          <div className="px-3xl py-xl">
            <DecisionSplitBar autoFixed={s.autoFixed} flagged={s.flagged} refused={s.refused} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Calibration"
            description="Whether the agent confidence matches reality. These are the numbers that decide how much rope it gets."
          />
          <div className="grid gap-xl px-3xl py-xl sm:grid-cols-3">
            {[
              { label: 'Fix success rate', value: s.fixSuccessRate, note: 'Applied fixes that survived without revert.' },
              { label: 'Flag agreement', value: s.flagAgreementRate, note: 'Flags a human reviewer agreed with.' },
              { label: 'Refusal vindicated', value: s.refusalVindicationRate, note: 'Refusals a human later confirmed were genuinely ambiguous.' },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-text-xs uppercase tracking-wide text-quaternary">{m.label}</p>
                <p className="tnum mt-xs text-display-xs font-semibold text-primary">{m.value}%</p>
                <div className="mt-md h-1.5 w-full overflow-hidden rounded-full bg-quaternary">
                  <div className="h-full rounded-full bg-brand-solid" style={{ width: `${m.value}%` }} />
                </div>
                <p className="mt-md text-text-xs leading-relaxed text-tertiary">{m.note}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-secondary px-3xl py-lg text-text-xs leading-relaxed text-tertiary">
            Refusal vindication is the metric most tools do not publish. If it were low, it would mean the
            agent refuses when it should have acted — restraint without judgement, which is just noise.
          </p>
        </Panel>
      </div>

      {trends ? (
        <Panel className="mb-xl">
          <PanelHeader
            title="Decisions over time"
            description="Auto-fix volume grows as the agent earns scope; the refusal band never disappears."
          />
          <div className="px-3xl py-xl">
            <DecisionMixChart data={trends} height={240} />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-xl lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Panel>
          <PanelHeader
            title="Agent activity"
            actions={<Link href="/reasoning" className="text-text-xs font-medium text-brand-secondary hover:underline">Reasoning center</Link>}
          />
          <ul className="divide-y divide-[color:var(--border-secondary)]">
            {data.activity.map((a) => (
              <li key={a.id}>
                <Link href={`/reasoning/${a.investigationId}`} className="flex items-start gap-lg px-3xl py-lg transition-colors hover:bg-primary-hover">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text-sm font-medium text-primary">{t(a.title)}</p>
                    <p className="mt-xxs truncate font-mono text-text-xs text-quaternary">
                      {a.repo} · {relativeTime(a.at)} · {formatDuration(a.durationMs)}
                    </p>
                  </div>
                  <span className="tnum shrink-0 font-mono text-text-xs text-tertiary">{a.confidence}%</span>
                  <DecisionBadge decision={a.decision} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-xl">
          <Panel>
            <PanelHeader title="Agent permissions" description="What this installation may read and write." />
            <ul className="divide-y divide-[color:var(--border-secondary)]">
              {[
                ['contents: read', true, 'Read workflow files and history'],
                ['actions: read', true, 'Read run logs and job metadata'],
                ['pull_requests: write', true, 'Open fix PRs'],
                ['checks: write', true, 'Post status on investigated runs'],
                ['organization_variables: read', false, 'Would resolve vars.WEBHOOK_URL in PG-1044'],
                ['environments: write', false, 'Would allow adding approval gates directly'],
              ].map(([scope, granted, note]) => (
                <li key={scope as string} className="flex items-start gap-lg px-xl py-lg">
                  <span className={cn('mt-xxs shrink-0', granted ? 'text-success-primary' : 'text-quaternary')}>
                    {granted ? <Icon.Check size={13} /> : <Icon.X size={13} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-text-xs text-secondary">{scope}</p>
                    <p className="mt-xxs text-text-xs leading-relaxed text-tertiary">{note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Decision thresholds" dense />
            <dl className="space-y-lg px-xl py-lg text-text-sm">
              <div className="flex items-baseline justify-between gap-lg">
                <dt className="text-quaternary">Auto-fix floor</dt>
                <dd className="tnum font-mono font-medium text-primary">90%</dd>
              </div>
              <div className="flex items-baseline justify-between gap-lg">
                <dt className="text-quaternary">Recommendation floor</dt>
                <dd className="tnum font-mono font-medium text-primary">45%</dd>
              </div>
              <div className="flex items-baseline justify-between gap-lg">
                <dt className="text-quaternary">Ambiguity band</dt>
                <dd className="tnum font-mono font-medium text-primary">15 pts</dd>
              </div>
            </dl>
            <p className="border-t border-secondary px-xl py-lg text-text-xs leading-relaxed text-tertiary">
              Confidence alone never authorises action. A production binding blocks autonomous permission
              changes at any confidence — see <Link href="/policies/pol_dep_002" className="text-brand-secondary hover:underline">PG-DEP-002</Link>.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
