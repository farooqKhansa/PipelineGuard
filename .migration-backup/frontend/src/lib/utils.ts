import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Decision, Severity } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  // The dataset is fixed in time, so anchor "now" to the newest event rather
  // than the wall clock. Otherwise the demo reads "6 months ago" next year.
  const now = Date.parse('2026-08-28T14:10:00Z');
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export const severityLabel: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const decisionLabel: Record<Decision, string> = {
  auto_fixed: 'Auto-fixed',
  flagged: 'Flagged for review',
  refused: 'Refused',
};

export const decisionShort: Record<Decision, string> = {
  auto_fixed: 'Auto-fix',
  flagged: 'Flag',
  refused: 'Refuse',
};

/** One line explaining what each outcome means, used in legends and tooltips. */
export const decisionMeaning: Record<Decision, string> = {
  auto_fixed: 'High confidence, bounded blast radius, reversible. The agent acted.',
  flagged: 'The agent drafted a fix and deliberately did not apply it.',
  refused: 'Evidence could not separate competing readings. No fix, no risk score.',
};

export function severityRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s];
}
