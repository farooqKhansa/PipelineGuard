'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { workflowSources } from '@/lib/mock/sources';
import { EmptyState, Panel, PanelHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Workflow configuration.
 *
 * Flagged lines are highlighted inline with the reason, so a reader sees the
 * finding where it lives rather than in a separate list. The note is the same
 * text the reasoning chain cited — one source, two surfaces.
 */
export default function PipelineConfigPage() {
  const params = useParams<{ id: string }>();
  const source = workflowSources[params.id];

  if (!source) {
    return (
      <Panel>
        <EmptyState
          title="No source captured"
          description="PipelineGuard has not fetched the workflow file for this pipeline yet."
          icon={<Icon.File size={18} />}
        />
      </Panel>
    );
  }

  const flaggedCount = Object.keys(source.flagged).length;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title={<span className="font-mono text-text-xs">{source.path}</span>}
        description={`${source.lines.length} lines · ${flaggedCount} flagged`}
      />
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {source.lines.map((line, i) => {
              const n = i + 1;
              const flag = source.flagged[n];
              return (
                <React.Fragment key={n}>
                  <tr className={cn(flag && 'bg-warning-primary')}>
                    <td className="tnum w-12 select-none border-e border-secondary px-md py-xxs text-end align-top font-mono text-text-xs text-quaternary">
                      {n}
                    </td>
                    <td className="w-4 select-none px-xs py-xxs align-top">
                      {flag ? <span className="text-warning-primary"><Icon.Alert size={11} /></span> : null}
                    </td>
                    <td
                      className={cn(
                        'whitespace-pre px-lg py-xxs font-mono text-text-xs leading-relaxed',
                        flag ? 'font-medium text-primary' : 'text-tertiary',
                      )}
                    >
                      {line || ' '}
                    </td>
                  </tr>
                  {flag ? (
                    <tr>
                      <td />
                      <td />
                      <td className="px-lg pb-md pt-xs">
                        <div className="flex flex-wrap items-start gap-md rounded-md border border-[color-mix(in_srgb,var(--sev-medium)_30%,transparent)] bg-warning-primary px-lg py-md">
                          <Link
                            href={`/findings/${flag.findingId}`}
                            className="shrink-0 font-mono text-text-xs font-medium text-warning-primary hover:underline"
                          >
                            {flag.findingId}
                          </Link>
                          <span className="text-text-xs leading-relaxed text-secondary">{flag.note}</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
