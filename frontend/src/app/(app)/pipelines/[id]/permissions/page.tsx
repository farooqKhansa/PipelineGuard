'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import type { Pipeline } from '@/lib/types';
import { Panel, PanelHeader, Skeleton, Table, Td, Th, Tr } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const SCOPES = ['contents', 'packages', 'id-token', 'deployments', 'issues', 'pull-requests', 'actions'];

/**
 * Effective permission matrix.
 *
 * The whole point of this screen is the word "effective". A reviewer reading
 * the YAML sees a root block and job blocks separately and has to merge them
 * in their head; that is exactly where the write-all mistake hides. Here the
 * merge is already done.
 */
export default function PipelinePermissionsPage() {
  const params = useParams<{ id: string }>();
  const { data: pipeline, initial } = usePolling<Pipeline>(`pipelines/${params.id}`, 0);

  if (initial || !pipeline) return <Skeleton className="h-[360px]" />;

  const writeCount = pipeline.jobs.reduce(
    (a, j) => a + Object.values(j.permissions).filter((v) => v === 'write').length, 0,
  );
  const overBroad = pipeline.jobs.filter(
    (j) => Object.values(j.permissions).filter((v) => v === 'write').length >= 3,
  );

  return (
    <>
      {overBroad.length > 0 ? (
        <Panel className="mb-xl border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary">
          <div className="flex items-start gap-lg px-3xl py-xl">
            <span className="mt-xxs shrink-0 text-warning-primary"><Icon.Alert size={18} /></span>
            <div>
              <p className="text-text-sm font-semibold text-primary">
                {overBroad.length} job{overBroad.length === 1 ? '' : 's'} hold three or more write scopes.
              </p>
              <p className="mt-xs max-w-paragraph text-text-sm leading-relaxed text-tertiary">
                Every write scope on a job is a capability a compromised step in that job inherits. Jobs{' '}
                <span className="font-mono text-secondary">{overBroad.map((j) => j.name).join(', ')}</span>{' '}
                can each reach more than the work they perform requires.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Effective permissions"
          description="After merging workflow-level and job-level blocks. This is what the token actually carries at runtime — not what any single block says."
          actions={
            <span className="tnum font-mono text-text-xs text-warning-primary">
              {writeCount} write scopes total
            </span>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Job</Th>
              {SCOPES.map((s) => <Th key={s} className="text-center">{s}</Th>)}
              <Th>Environment</Th>
            </tr>
          </thead>
          <tbody>
            {pipeline.jobs.map((job) => (
              <Tr key={job.id}>
                <Td className="font-mono text-text-xs font-medium text-primary">{job.name}</Td>
                {SCOPES.map((scope) => {
                  const level = job.permissions[scope];
                  return (
                    <Td key={scope} className="text-center">
                      {level === 'write' ? (
                        <span className="inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary px-md py-xxs font-mono text-text-xs font-medium text-warning-primary">
                          write
                        </span>
                      ) : level === 'read' ? (
                        <span className="font-mono text-text-xs text-tertiary">read</span>
                      ) : (
                        <span className="font-mono text-text-xs text-quaternary">—</span>
                      )}
                    </Td>
                  );
                })}
                <Td>
                  {job.environment ? (
                    <span className="rounded-full border border-error px-md py-xxs font-mono text-text-xs text-error-primary">
                      {job.environment}
                    </span>
                  ) : (
                    <span className="font-mono text-text-xs text-quaternary">—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
