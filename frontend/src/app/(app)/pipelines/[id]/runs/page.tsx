'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import type { PipelineRun } from '@/lib/types';
import { DecisionBadge, EmptyState, Panel, PanelHeader, Skeleton, Table, Td, Th, Tr } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, formatDuration, relativeTime } from '@/lib/utils';

export default function PipelineRunsPage() {
  const params = useParams<{ id: string }>();
  const { data, initial } = usePolling<PipelineRun[]>(`pipelines/${params.id}/runs`, 15_000);
  const runs = data ?? [];

  return (
    <Panel>
      <PanelHeader
        title="Run history"
        description="Configuration risk is scored per run, so a spike lines up with the commit that caused it."
      />
      {initial ? (
        <div className="p-3xl"><Skeleton className="h-64" /></div>
      ) : runs.length === 0 ? (
        <EmptyState title="No runs recorded" icon={<Icon.History size={18} />} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Run</Th>
              <Th>Commit</Th>
              <Th>Branch</Th>
              <Th className="text-end">Risk</Th>
              <Th>Agent</Th>
              <Th className="text-end">Duration</Th>
              <Th className="text-end">When</Th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Link href={`/pipelines/${params.id}/runs/${r.id}`} className="flex items-center gap-md">
                    <span className={r.status === 'passed' ? 'text-success-primary' : r.status === 'failed' ? 'text-error-primary' : 'text-quaternary'}>
                      {r.status === 'passed' ? <Icon.Check size={13} /> : <Icon.X size={13} />}
                    </span>
                    <span className="font-mono text-text-xs hover:underline">#{r.number}</span>
                  </Link>
                </Td>
                <Td className="max-w-[260px]">
                  <span className="block truncate text-text-xs text-secondary">{r.commitMessage}</span>
                  <span className="block font-mono text-text-xs text-quaternary">{r.commit} · {r.author}</span>
                </Td>
                <Td className="font-mono text-text-xs text-tertiary">{r.branch}</Td>
                <Td className="text-end">
                  <span className={cn('tnum font-mono text-text-xs', r.riskScore > 60 ? 'text-error-primary' : r.riskScore > 35 ? 'text-warning-primary' : 'text-tertiary')}>
                    {r.riskScore}
                  </span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-xs">
                    {r.decisions.length === 0
                      ? <span className="text-text-xs text-quaternary">—</span>
                      : r.decisions.map((d, i) => <DecisionBadge key={i} decision={d} size="sm" />)}
                  </div>
                </Td>
                <Td className="tnum text-end font-mono text-text-xs text-quaternary">{formatDuration(r.durationMs)}</Td>
                <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(r.startedAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
