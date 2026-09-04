'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import type { DependencyGraph } from '@/lib/types';
import { EmptyState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives';
import { DependencyGraphView } from '@/components/graph/dependency-graph';
import { Icon } from '@/components/ui/icons';

export default function PipelineGraphPage() {
  const params = useParams<{ id: string }>();
  const { data, initial, error } = usePolling<DependencyGraph>(`pipelines/${params.id}/graph`, 0);

  return (
    <Panel>
      <PanelHeader
        title="Dependency graph"
        description="Jobs, the secrets they read, and everything downstream. Click a node to trace what a compromise there would reach."
      />
      <div className="p-3xl">
        {initial ? (
          <Skeleton className="h-[420px]" />
        ) : !data || error ? (
          <EmptyState
            title="No graph captured for this pipeline"
            description="PipelineGuard builds the graph on the first run it observes."
            icon={<Icon.Graph size={18} />}
          />
        ) : (
          <DependencyGraphView graph={data} />
        )}
      </div>
    </Panel>
  );
}
