'use client';

import React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { TrendPoint } from '@/lib/types';
import { ramp } from '@/lib/design/tokens';
import { useLocale, useTheme } from '@/lib/providers';

/**
 * Chart colours resolve from the design-system ramps rather than CSS variables,
 * because Recharts renders to SVG attributes that cannot read var(). The values
 * are the same tokens the rest of the UI uses -- picked one step lighter in
 * dark mode so lines stay legible on the #0c0e12 ground.
 */
function usePalette() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    grid: dark ? '#22262f' : '#e9eaeb',
    axis: dark ? '#94979c' : '#717680',
    surface: dark ? '#13161b' : '#ffffff',
    border: dark ? '#373a41' : '#d5d7da',
    ink: dark ? '#f7f7f7' : '#181d27',
    subtle: dark ? '#94979c' : '#535862',
    brand: dark ? ramp.brand[400] : ramp.brand[600],
    success: dark ? ramp.success[400] : ramp.success[600],
    warning: dark ? ramp.warning[400] : ramp.warning[600],
    error: dark ? ramp.error[400] : ramp.error[600],
    neutral: dark ? ramp.gray[400] : ramp.gray[500],
    cyan: dark ? ramp.cyan[400] : ramp.cyan[600],
  };
}

function ChartTooltip({ active, payload, label, suffix }: any) {
  const p = usePalette();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-lg py-md shadow-lg"
      style={{ background: p.surface, borderColor: p.border }}
    >
      <p className="mb-xs font-mono text-text-xs" style={{ color: p.subtle }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-md text-text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: p.subtle }}>{entry.name}</span>
          <span className="tnum ms-auto font-mono font-medium" style={{ color: p.ink }}>
            {entry.value}{suffix ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

const axisProps = (colour: string) => ({
  stroke: colour,
  tick: { fill: colour, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
  axisLine: false,
});

/** Date axis. `minTickGap` lets Recharts drop labels rather than crowd them,
 *  so a 14-day window stays readable in a half-width panel and still shows
 *  every label when the chart is given the full page. */
const dateAxis = (colour: string) => ({
  ...axisProps(colour),
  dataKey: 'label',
  minTickGap: 18,
  interval: 'preserveStartEnd' as const,
});

/**
 * Risk over time, with the narrative annotated on the line.
 *
 * A single risk number is a snapshot and says nothing. The same number falling
 * from 78 to 31 over fourteen days, with the reason for each inflection marked,
 * is an argument that the tool works.
 */
export function RiskTrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  const p = usePalette();
  const { t } = useLocale();
  const annotated = data.filter((d) => d.annotation);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.brand} stopOpacity={0.28} />
              <stop offset="100%" stopColor={p.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={p.grid} vertical={false} />
          <XAxis {...dateAxis(p.axis)} />
          <YAxis domain={[0, 100]} {...axisProps(p.axis)} width={44} />
          <Tooltip content={<ChartTooltip suffix="" />} cursor={{ stroke: p.border }} />
          <Area
            type="monotone"
            dataKey="riskScore"
            name="Mean config risk"
            stroke={p.brand}
            strokeWidth={2}
            fill="url(#riskFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          {annotated.map((d) => (
            <ReferenceDot
              key={d.date}
              x={d.label}
              y={d.riskScore}
              r={4}
              fill={p.surface}
              stroke={p.brand}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <ol className="mt-xl space-y-md border-t border-secondary pt-xl">
        {annotated.map((d) => (
          <li key={d.date} className="flex gap-lg text-text-sm">
            <span className="tnum w-14 shrink-0 font-mono text-text-xs text-quaternary">{d.label}</span>
            <span
              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: p.brand }}
            />
            <span className="text-tertiary">{t(d.annotation!)}</span>
            <span className="tnum ms-auto shrink-0 font-mono text-text-xs text-quaternary">
              risk {d.riskScore}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PassFailChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const p = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis {...dateAxis(p.axis)} />
        <YAxis {...axisProps(p.axis)} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: p.grid, opacity: 0.4 }} />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 12, color: p.subtle, paddingTop: 8 }}
        />
        <Bar dataKey="passed" name="Passed" stackId="runs" fill={p.success} radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" name="Failed" stackId="runs" fill={p.error} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** The three outcomes over time. The refusal band is the honest one — a band
 *  that is always zero would mean the agent never exercises restraint. */
export function DecisionMixChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const p = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis {...dateAxis(p.axis)} />
        <YAxis {...axisProps(p.axis)} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: p.border }} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, color: p.subtle, paddingTop: 8 }} />
        <Area type="monotone" dataKey="autoFixed" name="Auto-fixed" stackId="d" stroke={p.success} fill={p.success} fillOpacity={0.5} strokeWidth={1.5} />
        <Area type="monotone" dataKey="flagged" name="Flagged" stackId="d" stroke={p.warning} fill={p.warning} fillOpacity={0.5} strokeWidth={1.5} />
        <Area type="monotone" dataKey="refused" name="Refused" stackId="d" stroke={p.neutral} fill={p.neutral} fillOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FindingsFlowChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const p = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis {...dateAxis(p.axis)} />
        <YAxis {...axisProps(p.axis)} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: p.border }} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, color: p.subtle, paddingTop: 8 }} />
        <Line type="monotone" dataKey="findingsOpened" name="Opened" stroke={p.warning} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="findingsResolved" name="Resolved" stroke={p.success} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MttrChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const p = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="mttrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.cyan} stopOpacity={0.3} />
            <stop offset="100%" stopColor={p.cyan} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis {...dateAxis(p.axis)} />
        <YAxis {...axisProps(p.axis)} width={44} unit="h" />
        <Tooltip content={<ChartTooltip suffix="h" />} cursor={{ stroke: p.border }} />
        <Area type="monotone" dataKey="mttrHours" name="Mean time to resolution" stroke={p.cyan} strokeWidth={2} fill="url(#mttrFill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal breakdown of the three outcomes for a reporting window. */
export function DecisionSplitBar({
  autoFixed, flagged, refused,
}: { autoFixed: number; flagged: number; refused: number }) {
  const p = usePalette();
  const total = Math.max(1, autoFixed + flagged + refused);
  const rows = [
    { label: 'Auto-fixed', value: autoFixed, colour: p.success, note: 'acted without a human' },
    { label: 'Flagged', value: flagged, colour: p.warning, note: 'fix drafted, held for review' },
    { label: 'Refused', value: refused, colour: p.neutral, note: 'no fix, escalated as a question' },
  ];
  return (
    <div className="space-y-lg">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-quaternary">
        {rows.map((r) => (
          <span key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: r.colour }} />
        ))}
      </div>
      <ul className="space-y-md">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline gap-md text-text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.colour }} />
            <span className="text-secondary">{r.label}</span>
            <span className="text-text-xs text-quaternary">{r.note}</span>
            <span className="tnum ms-auto font-mono font-medium text-primary">{r.value}</span>
            <span className="tnum w-10 text-end font-mono text-text-xs text-quaternary">
              {((r.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
