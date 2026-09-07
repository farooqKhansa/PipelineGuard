import React, { useState } from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import type { DependencyGraph, Pipeline } from '@/lib/types';
import { PageHeader, Panel, PanelHeader, Skeleton, StatTile } from '@/components/ui/primitives';
import { DependencyGraphView } from '@/components/graph/dependency-graph';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const graphable = [
  { id: 'pl_deploy_prod', label: 'Deploy (production)', repo: 'northwind/checkout-service' },
  { id: 'pl_ci_checkout', label: 'CI', repo: 'northwind/checkout-service' },
];

export default function DependencyIntelligencePage() {
  const [selected, setSelected] = useState(graphable[0].id);
  const { data: graph, initial } = usePolling<DependencyGraph>(`graphs/${selected}`, 0);
  const { data: pipeline } = usePolling<Pipeline>(`pipelines/${selected}`, 0);

  const prodNodes = graph?.nodes.filter((n) => n.production).length ?? 0;
  const secrets = graph?.nodes.filter((n) => n.kind === 'secret').length ?? 0;
  const taintedEdges = graph?.edges.filter((e) => e.tainted).length ?? 0;

  return (
    <>
      <PageHeader
        title="Dependency intelligence"
        description="A pipeline is a graph, not a list of steps. This is the structure the agent reasons over when it asks what a change actually touches."
      />

      <div className="mb-xl flex flex-wrap gap-md">
        {graphable.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelected(g.id)}
            className={cn(
              'rounded-md border px-xl py-md text-start transition-colors',
              selected === g.id
                ? 'border-primary bg-tertiary'
                : 'border-secondary bg-primary hover:border-primary',
            )}
          >
            <span className="block text-text-sm font-medium text-primary">{g.label}</span>
            <span className="block font-mono text-text-xs text-quaternary">{g.repo}</span>
          </button>
        ))}
      </div>

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Nodes" value={graph?.nodes.length ?? '—'} sub="Jobs, secrets, environments, services" icon={<Icon.Graph size={15} />} />
        <StatTile label="Production reach" value={prodNodes} sub="Nodes that touch a production system" tone={prodNodes > 0 ? 'critical' : 'good'} icon={<Icon.Alert size={15} />} />
        <StatTile label="Secrets in graph" value={secrets} sub="Credentials readable from a job" icon={<Icon.Key size={15} />} />
        <StatTile label="Tainted paths" value={taintedEdges} sub="Edges on a compromise route" tone="warn" icon={<Icon.Activity size={15} />} />
      </div>

      <Panel className="mb-xl">
        <PanelHeader
          title="Blast radius map"
          description="Click any node to trace forward through the graph. This is exactly the traversal the agent runs during the dependency step of an investigation."
          actions={
            pipeline ? (
              <Link href={`/pipelines/${pipeline.id}`} className="text-text-xs font-medium text-brand-secondary hover:underline">
                Pipeline detail
              </Link>
            ) : null
          }
        />
        <div className="p-3xl">
          {initial || !graph ? (
            <Skeleton className="h-[420px]" />
          ) : (
            <DependencyGraphView graph={graph} />
          )}
        </div>
      </Panel>

      <div className="grid gap-xl lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Why the graph matters"
            description="The blind spot this product exists to close."
          />
          <div className="space-y-lg px-3xl py-xl text-text-sm leading-relaxed text-tertiary">
            <p>
              A scanner that reads one job in isolation sees{' '}
              <span className="font-mono text-secondary">test</span> with{' '}
              <span className="font-mono text-secondary">contents: read</span> and reports nothing. That is
              the correct answer to the wrong question.
            </p>
            <p>
              The graph shows that <span className="font-mono text-secondary">test</span> produces an
              artifact that <span className="font-mono text-secondary">build</span> consumes without a
              checksum, and <span className="font-mono text-secondary">build</span> holds{' '}
              <span className="font-mono text-secondary">packages: write</span>. The permission that matters
              is two hops away from the code that would be compromised.
            </p>
            <p>
              Every dependency step in a reasoning chain links back to this view, so the claim{' '}
              <span className="text-secondary">&ldquo;cross-referenced with job build via the dependency graph&rdquo;</span>{' '}
              is a link a reviewer can click, not a phrase in a summary.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Relationship types tracked" />
          <ul className="divide-y divide-[color:var(--border-secondary)]">
            {[
              ['needs', 'Job ordering. Establishes which jobs can influence which.'],
              ['reads_secret', 'A job that can read a credential. The credential inherits the job risk.'],
              ['consumes', 'Artifact passed between jobs. Integrity gap unless checksummed.'],
              ['publishes', 'Output leaving the pipeline: a registry, an artifact store.'],
              ['deploys_to', 'Binding to an environment. Production bindings block autonomous action.'],
              ['calls', 'Downstream services reached by a deployed environment.'],
            ].map(([kind, note]) => (
              <li key={kind} className="flex gap-lg px-3xl py-lg">
                <span className="w-28 shrink-0 font-mono text-text-xs text-brand-secondary">{kind}</span>
                <span className="text-text-sm text-tertiary">{note}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
