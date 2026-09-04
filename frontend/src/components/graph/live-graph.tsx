'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Animated propagation graph.
 *
 * Renders `graph_path` from the Detection Core as a live node chain rather than
 * a text list. Nodes arrive one at a time and edges flow while the run is being
 * analysed, so "job A affects job B" is something a judge watches happen rather
 * than reads.
 *
 * Deliberately not a physics simulation: the path is linear and short, so fixed
 * spacing draws identically every time. A force layout would only jitter.
 */

export interface LiveGraphNode {
  id: string;
  label: string;
  /** Terminal nodes (registry, environment, external service) render distinctly. */
  terminal?: boolean;
}

export function LivePropagationGraph({
  path,
  revealed,
  flowing = false,
  className,
}: {
  /** Node ids in propagation order. */
  path: string[];
  /** How many nodes to show. Pass path.length for the settled state. */
  revealed?: number;
  /** Animate the edges, i.e. the run is still being analysed. */
  flowing?: boolean;
  className?: string;
}) {
  const shown = revealed ?? path.length;

  const layout = useMemo(() => {
    const NODE_W = 132;
    const NODE_H = 42;
    const GAP = 46;
    const PAD = 12;
    const width = path.length * NODE_W + (path.length - 1) * GAP + PAD * 2;
    const height = NODE_H + PAD * 2 + 22;
    return {
      NODE_W, NODE_H, GAP, PAD, width, height,
      x: (i: number) => PAD + i * (NODE_W + GAP),
      y: PAD + 11,
    };
  }, [path.length]);

  if (path.length === 0) {
    return (
      <p className={cn('text-text-sm text-quaternary', className)}>
        No propagation path was supplied by the Detection Core.
      </p>
    );
  }

  return (
    <div className={cn('scroll-thin overflow-x-auto', className)}>
      <svg width={layout.width} height={layout.height} className="block">
        <defs>
          <marker id="lg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--fg-brand-primary)" />
          </marker>
        </defs>

        {path.slice(0, -1).map((_, i) => {
          const visible = i < shown - 1;
          const x1 = layout.x(i) + layout.NODE_W;
          const x2 = layout.x(i + 1);
          const y = layout.y + layout.NODE_H / 2;
          return (
            <g key={`e${i}`} opacity={visible ? 1 : 0} style={{ transition: 'opacity 320ms ease' }}>
              <line
                x1={x1} y1={y} x2={x2 - 8} y2={y}
                stroke="var(--fg-brand-primary)"
                strokeWidth="1.75"
                markerEnd="url(#lg-arrow)"
                className={flowing && visible ? 'edge-flow' : undefined}
              />
            </g>
          );
        })}

        {path.map((id, i) => {
          const visible = i < shown;
          const terminal = i === path.length - 1;
          return (
            <g
              key={id + i}
              transform={`translate(${layout.x(i)},${layout.y})`}
              opacity={visible ? 1 : 0}
              className={visible ? 'node-arrive' : undefined}
              style={{
                transition: 'opacity 320ms ease',
                animationDelay: `${i * 90}ms`,
                transformOrigin: 'center',
              }}
            >
              <rect
                width={layout.NODE_W}
                height={layout.NODE_H}
                rx="9"
                fill={terminal ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}
                stroke={terminal ? 'var(--risk-elevated)' : 'var(--border-brand)'}
                strokeWidth="1.5"
                strokeDasharray={terminal ? '4 3' : undefined}
              />
              <text
                x={layout.NODE_W / 2}
                y={layout.NODE_H / 2 + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="500"
                fill="var(--text-primary)"
                className="font-mono"
              >
                {id.length > 15 ? `${id.slice(0, 14)}…` : id}
              </text>
              <text
                x={layout.NODE_W / 2}
                y={layout.NODE_H + 15}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-quaternary)"
                className="font-mono uppercase"
              >
                {i === 0 ? 'origin' : terminal ? 'reaches' : `hop ${i}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
