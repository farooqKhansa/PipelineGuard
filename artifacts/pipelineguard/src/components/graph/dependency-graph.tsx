import React, { useMemo, useState } from 'react';
import type { DependencyGraph, GraphNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';

const COL_W = 190;
const ROW_H = 78;
const NODE_W = 152;
const NODE_H = 44;
const PAD = 28;

const kindMeta: Record<GraphNode['kind'], { icon: React.ReactNode; label: string }> = {
  job: { icon: <Icon.Pipeline size={12} />, label: 'Job' },
  secret: { icon: <Icon.Key size={12} />, label: 'Secret' },
  environment: { icon: <Icon.Layers size={12} />, label: 'Environment' },
  artifact: { icon: <Icon.File size={12} />, label: 'Artifact' },
  registry: { icon: <Icon.Repo size={12} />, label: 'Registry' },
  external: { icon: <Icon.Globe size={12} />, label: 'Downstream service' },
};

const edgeLabel: Record<string, string> = {
  needs: 'needs',
  reads_secret: 'reads',
  deploys_to: 'deploys to',
  publishes: 'publishes',
  consumes: 'consumes',
  calls: 'calls',
};

/**
 * Pipeline dependency graph.
 *
 * Rendered as SVG from server-computed column/row coordinates -- no layout
 * library, no physics simulation. A CI graph is a DAG with a known topology,
 * so a force-directed layout would only make it jitter and drift between
 * renders. Fixed coordinates mean the same graph looks the same every demo.
 *
 * Selecting a node traces its blast radius forward through the edges, which is
 * the question a reviewer actually asks: if this is compromised, what else is?
 */
export function DependencyGraphView({
  graph, initialSelected = null, className,
}: {
  graph: DependencyGraph;
  initialSelected?: string | null;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialSelected);

  const cols = Math.max(...graph.nodes.map((n) => n.column)) + 1;
  const rows = Math.max(...graph.nodes.map((n) => n.row)) + 1;
  const width = cols * COL_W + PAD * 2;
  const height = rows * ROW_H + PAD * 2;

  const pos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of graph.nodes) {
      map.set(n.id, {
        x: PAD + n.column * COL_W,
        y: PAD + n.row * ROW_H,
      });
    }
    return map;
  }, [graph.nodes]);

  /** Nodes reachable from `selected` by following edges forward. */
  const reachable = useMemo(() => {
    if (!selected) return null;
    const seen = new Set<string>([selected]);
    const queue = [selected];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of graph.edges) {
        if (e.from === cur && !seen.has(e.to)) {
          seen.add(e.to);
          queue.push(e.to);
        }
      }
    }
    return seen;
  }, [selected, graph.edges]);

  const selectedNode = selected ? graph.nodes.find((n) => n.id === selected) ?? null : null;
  const productionHits = reachable
    ? graph.nodes.filter((n) => reachable.has(n.id) && n.production && n.id !== selected)
    : [];

  return (
    <div className={className}>
      <div className="scroll-thin overflow-x-auto rounded-lg border border-secondary bg-secondary">
        <svg width={width} height={height} className="block min-w-full">
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--fg-quaternary)" />
            </marker>
            <marker id="arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--fg-error-primary)" />
            </marker>
          </defs>

          {graph.edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            const hot = reachable ? reachable.has(e.from) && reachable.has(e.to) : false;
            const dim = reachable ? !hot : false;

            return (
              <g key={i} opacity={dim ? 0.18 : 1}>
                <path
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={hot ? 'var(--fg-error-primary)' : 'var(--border-primary)'}
                  strokeWidth={hot ? 1.75 : 1.25}
                  strokeDasharray={e.kind === 'reads_secret' ? '4 3' : undefined}
                  markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
                />
                <text
                  x={mid}
                  y={(y1 + y2) / 2 - 5}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="9"
                  fill="var(--fg-quaternary)"
                >
                  {edgeLabel[e.kind]}
                </text>
              </g>
            );
          })}

          {graph.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const inRadius = reachable ? reachable.has(n.id) : false;
            const dim = reachable ? !inRadius : false;
            const isSelected = selected === n.id;
            const hasFinding = n.findingIds.length > 0;

            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={dim ? 0.25 : 1}
                onClick={() => setSelected(isSelected ? null : n.id)}
                className="cursor-pointer"
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="8"
                  fill={isSelected ? 'var(--bg-brand-primary-alt)' : 'var(--bg-primary)'}
                  stroke={
                    isSelected ? 'var(--border-brand)'
                      : inRadius && n.production ? 'var(--fg-error-primary)'
                        : hasFinding ? 'var(--sev-medium)'
                          : 'var(--border-primary)'
                  }
                  strokeWidth={isSelected ? 2 : 1.25}
                />
                <text x="12" y="18" fontSize="10" className="font-mono" fill="var(--fg-quaternary)">
                  {kindMeta[n.kind].label}
                </text>
                <text x="12" y="33" fontSize="12" fontWeight="500" fill="var(--text-primary)">
                  {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
                </text>
                {n.production ? (
                  <circle cx={NODE_W - 12} cy="14" r="3.5" fill="var(--fg-error-primary)" />
                ) : null}
                {hasFinding ? (
                  <circle cx={NODE_W - 12} cy={n.production ? 28 : 14} r="3.5" fill="var(--sev-medium)" />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-lg flex flex-wrap items-center gap-xl text-text-xs text-tertiary">
        <span className="flex items-center gap-xs">
          <span className="h-2 w-2 rounded-full bg-[color:var(--fg-error-primary)]" /> reaches production
        </span>
        <span className="flex items-center gap-xs">
          <span className="h-2 w-2 rounded-full bg-[color:var(--sev-medium)]" /> has an open finding
        </span>
        <span className="flex items-center gap-xs">
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--border-primary)" strokeDasharray="4 3" /></svg>
          reads a secret
        </span>
        <span className="ms-auto text-quaternary">Click any node to trace its blast radius.</span>
      </div>

      {selectedNode ? (
        <div className="mt-lg rounded-lg border border-secondary bg-primary px-xl py-lg">
          <div className="flex flex-wrap items-center gap-md">
            <span className="text-quaternary">{kindMeta[selectedNode.kind].icon}</span>
            <span className="font-mono text-text-sm font-medium text-primary">{selectedNode.label}</span>
            <span className="text-text-xs text-quaternary">{kindMeta[selectedNode.kind].label}</span>
            <button
              onClick={() => setSelected(null)}
              className="ms-auto text-text-xs text-quaternary hover:text-secondary"
            >
              Clear
            </button>
          </div>
          <p className="mt-md text-text-sm leading-relaxed text-tertiary">
            A compromise here reaches{' '}
            <span className="font-medium text-primary">{(reachable?.size ?? 1) - 1} downstream node{(reachable?.size ?? 1) - 1 === 1 ? '' : 's'}</span>
            {productionHits.length > 0 ? (
              <>
                , of which{' '}
                <span className="font-medium text-error-primary">
                  {productionHits.length} touch production
                </span>
                : <span className="font-mono text-text-xs">{productionHits.map((n) => n.label).join(', ')}</span>
              </>
            ) : (
              <>, none of which touch production</>
            )}
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
