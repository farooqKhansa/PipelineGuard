'use client';

import React from 'react';
import { usePolling } from '@/lib/api/hooks';
import type { TrendPoint } from '@/lib/types';
import { PageHeader, Panel, PanelHeader, Skeleton, StatTile } from '@/components/ui/primitives';
import {
  DecisionMixChart, FindingsFlowChart, MttrChart, PassFailChart, RiskTrendChart,
} from '@/components/charts/trend-charts';
import { Icon } from '@/components/ui/icons';

export default function TrendsPage() {
  const { data, initial } = usePolling<TrendPoint[]>('trends', 30_000);
  const trends = data ?? [];

  if (initial || trends.length === 0) {
    return (
      <>
        <PageHeader title="Trends" description="Loading the 14-day window." />
        <Skeleton className="h-[400px]" />
      </>
    );
  }

  const first = trends[0];
  const last = trends[trends.length - 1];
  const totalOpened = trends.reduce((a, t) => a + t.findingsOpened, 0);
  const totalResolved = trends.reduce((a, t) => a + t.findingsResolved, 0);
  const totalRuns = trends.reduce((a, t) => a + t.passed + t.failed, 0);
  const totalPassed = trends.reduce((a, t) => a + t.passed, 0);
  const passRate = ((totalPassed / totalRuns) * 100).toFixed(1);
  const riskDrop = last.riskScore - first.riskScore;
  const mttrDrop = last.mttrHours - first.mttrHours;

  return (
    <>
      <PageHeader
        title="Trends"
        description="Fourteen days of one organisation's pipeline health. The point of this screen is the direction of travel, not any single day's number."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Config risk"
          value={last.riskScore}
          delta={{ value: `${riskDrop}`, good: riskDrop < 0 }}
          sub={`Down from ${first.riskScore} on ${first.label}`}
          tone="good"
          icon={<Icon.Radar size={15} />}
        />
        <StatTile
          label="Time to resolution"
          value={`${last.mttrHours}h`}
          delta={{ value: `${mttrDrop}h`, good: mttrDrop < 0 }}
          sub={`Down from ${first.mttrHours}h`}
          tone="good"
          icon={<Icon.Clock size={15} />}
        />
        <StatTile
          label="Findings resolved"
          value={totalResolved}
          sub={`Against ${totalOpened} opened`}
          tone={totalResolved > totalOpened ? 'good' : 'warn'}
          icon={<Icon.Check size={15} />}
        />
        <StatTile
          label="Run pass rate"
          value={`${passRate}%`}
          sub={`${totalRuns} runs in the window`}
          icon={<Icon.Activity size={15} />}
        />
      </div>

      <Panel className="mb-xl">
        <PanelHeader
          title="Configuration risk, annotated"
          description="Risk falls as the agent gets access, learns the baseline, and is allowed to act. Each marker names the change that moved it."
        />
        <div className="px-3xl py-xl">
          <RiskTrendChart data={trends} height={300} />
        </div>
      </Panel>

      <div className="grid gap-xl lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Findings opened vs resolved"
            description="The crossover on 23 Aug is the point the backlog started shrinking."
          />
          <div className="px-3xl py-xl">
            <FindingsFlowChart data={trends} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Agent decisions over time"
            description="The refusal band is deliberately visible. A band pinned at zero would mean the agent never exercises restraint."
          />
          <div className="px-3xl py-xl">
            <DecisionMixChart data={trends} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Pipeline pass / fail"
            description="Run outcomes per day across all monitored pipelines."
          />
          <div className="px-3xl py-xl">
            <PassFailChart data={trends} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Mean time to resolution"
            description="From detection to a merged fix or an accepted risk decision."
          />
          <div className="px-3xl py-xl">
            <MttrChart data={trends} />
          </div>
        </Panel>
      </div>

      <Panel className="mt-xl">
        <PanelHeader title="What this window shows" />
        <div className="px-3xl py-xl">
          <p className="max-w-paragraph text-text-sm leading-relaxed text-tertiary">
            Configuration risk fell from {first.riskScore} to {last.riskScore} over fourteen days, and mean
            time to resolution fell from {first.mttrHours} hours to {last.mttrHours}. Neither number moved
            because a scanner started reporting more — {totalResolved} findings were resolved against{' '}
            {totalOpened} opened, and the crossover happened on 23 August, four days after autonomous fixes
            were enabled for non-production pipelines. The refusal band never reaches zero, which is the
            intended behaviour: on any given day there are changes whose intent the evidence does not settle.
          </p>
        </div>
      </Panel>
    </>
  );
}
