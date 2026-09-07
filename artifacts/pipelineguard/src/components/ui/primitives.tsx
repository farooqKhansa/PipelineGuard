import React from 'react';
import { Link } from 'wouter';
import { cn, decisionLabel, severityLabel } from '@/lib/utils';
import type { Decision, FindingStatus, Severity } from '@/lib/types';
import { Icon } from './icons';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Panel({
  className, children, ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-xl border border-secondary bg-primary',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title, description, actions, className, dense,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-xl border-b border-secondary',
        dense ? 'px-xl py-lg' : 'px-3xl py-xl',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 dir="auto" className="text-text-sm font-semibold text-primary">{title}</h2>
        {description ? (
          <p dir="auto" className="mt-xxs text-text-sm text-tertiary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-md">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const severityStyles: Record<Severity, string> = {
  critical: 'border-[color-mix(in_srgb,var(--sev-critical)_35%,transparent)] bg-error-primary text-error-primary',
  high: 'border-[color-mix(in_srgb,var(--sev-high)_30%,transparent)] bg-error-primary text-error-primary',
  medium: 'border-[color-mix(in_srgb,var(--sev-medium)_30%,transparent)] bg-warning-primary text-warning-primary',
  low: 'border-secondary bg-tertiary text-tertiary',
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs rounded-full border px-md py-xxs text-text-xs font-medium',
        severityStyles[severity],
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `var(--sev-${severity})` }}
      />
      {severityLabel[severity]}
    </span>
  );
}

/**
 * Decision badge.
 *
 * Refusal is intentionally the only one with a dashed border and no colour
 * fill. It should read as "held back", not as pass or fail -- an agent that
 * declines to act has not failed, and colouring it red would teach the wrong
 * lesson to the person reading the dashboard.
 */
export function DecisionBadge({
  decision, className, size = 'md',
}: { decision: Decision; className?: string; size?: 'sm' | 'md' }) {
  const styles: Record<Decision, string> = {
    auto_fixed: 'border-[color-mix(in_srgb,var(--decision-autofix)_35%,transparent)] bg-decision-autofix-bg text-[color:var(--decision-autofix)]',
    flagged: 'border-[color-mix(in_srgb,var(--decision-flag)_35%,transparent)] bg-decision-flag-bg text-[color:var(--decision-flag)]',
    refused: 'border-dashed border-[color-mix(in_srgb,var(--decision-refuse)_50%,transparent)] bg-decision-refuse-bg text-[color:var(--decision-refuse)]',
  };
  const glyph: Record<Decision, React.ReactNode> = {
    auto_fixed: <Icon.Check size={12} />,
    flagged: <Icon.Alert size={12} />,
    refused: <Icon.Hand size={12} />,
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs rounded-full border font-medium',
        size === 'sm' ? 'px-md py-xxs text-text-xs' : 'px-lg py-xs text-text-xs',
        styles[decision],
        className,
      )}
    >
      {glyph[decision]}
      {decisionLabel[decision]}
    </span>
  );
}

const statusStyles: Record<FindingStatus, string> = {
  open: 'bg-warning-primary text-warning-primary border-[color-mix(in_srgb,var(--sev-medium)_30%,transparent)]',
  fixed: 'bg-success-primary text-success-primary border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)]',
  in_review: 'bg-brand-primary-alt text-brand-secondary border-brand',
  accepted_risk: 'bg-tertiary text-tertiary border-secondary',
  refused: 'bg-tertiary text-tertiary border-dashed border-primary',
};

const statusLabels: Record<FindingStatus, string> = {
  open: 'Open',
  fixed: 'Fixed',
  in_review: 'In review',
  accepted_risk: 'Accepted risk',
  refused: 'Refused',
};

export function StatusBadge({ status, className }: { status: FindingStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-md py-xxs text-text-xs font-medium', statusStyles[status], className)}>
      {statusLabels[status]}
    </span>
  );
}

export function Chip({
  children, className, tone = 'neutral', href,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'brand' | 'mono';
  href?: string | null;
}) {
  const cls = cn(
    'inline-flex items-center gap-xs rounded-md border px-md py-xxs text-text-xs',
    tone === 'brand' && 'border-brand bg-brand-primary-alt text-brand-secondary',
    tone === 'mono' && 'border-secondary bg-tertiary font-mono text-tertiary',
    tone === 'neutral' && 'border-secondary bg-tertiary text-tertiary',
    href && 'transition-colors hover:border-primary hover:text-secondary',
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <span className={cls}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-md rounded-md border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-lg py-xs text-text-xs' : 'px-xl py-md text-text-sm',
        variant === 'primary' && 'border-transparent bg-brand-solid text-white hover:bg-brand-solid-hover',
        variant === 'secondary' && 'border-primary bg-primary text-secondary hover:bg-primary-hover',
        variant === 'ghost' && 'border-transparent bg-transparent text-tertiary hover:bg-primary-hover hover:text-secondary',
        variant === 'danger' && 'border-transparent bg-error-solid text-white hover:opacity-90',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function StatTile({
  label, value, sub, delta, tone = 'neutral', icon, href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Signed change. Direction is interpreted by `tone`. */
  delta?: { value: string; good: boolean } | null;
  tone?: 'neutral' | 'critical' | 'good' | 'warn';
  icon?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-md">
        <span className="text-text-xs font-medium uppercase tracking-wide text-quaternary">{label}</span>
        {icon ? <span className="text-quaternary">{icon}</span> : null}
      </div>
      <div className="mt-md flex items-baseline gap-md">
        <span
          className={cn(
            'tnum text-display-xs font-semibold',
            tone === 'neutral' && 'text-primary',
            tone === 'critical' && 'text-error-primary',
            tone === 'good' && 'text-success-primary',
            tone === 'warn' && 'text-warning-primary',
          )}
        >
          {value}
        </span>
        {delta ? (
          <span className={cn('tnum text-text-xs font-medium', delta.good ? 'text-success-primary' : 'text-error-primary')}>
            {delta.value}
          </span>
        ) : null}
      </div>
      {sub ? <p className="mt-xs text-text-xs text-tertiary">{sub}</p> : null}
    </>
  );

  const cls = 'rounded-xl border border-secondary bg-primary px-xl py-lg transition-colors';
  if (href) {
    return <Link href={href} className={cn(cls, 'block hover:border-primary')}>{body}</Link>;
  }
  return <div className={cls}>{body}</div>;
}

// ---------------------------------------------------------------------------
// Confidence meter
// ---------------------------------------------------------------------------

/**
 * Confidence, drawn against its thresholds.
 *
 * A bare percentage is the thing the brief warned about. This renders the two
 * decision floors as ticks on the track, so the number is legible as a
 * *position relative to a rule*, not a score out of a hundred.
 */
export function ConfidenceMeter({
  value, autoFixFloor = 90, recommendFloor = 45, decision, showScale = true,
}: {
  value: number;
  autoFixFloor?: number;
  recommendFloor?: number;
  decision?: Decision;
  showScale?: boolean;
}) {
  const colour =
    decision === 'auto_fixed' ? 'var(--decision-autofix)'
      : decision === 'flagged' ? 'var(--decision-flag)'
        : decision === 'refused' ? 'var(--decision-refuse)'
          : 'var(--fg-brand-primary)';

  return (
    <div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-quaternary">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${value}%`, background: colour }}
        />
        <span className="absolute top-0 h-full w-px bg-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)]" style={{ left: `${recommendFloor}%` }} />
        <span className="absolute top-0 h-full w-px bg-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)]" style={{ left: `${autoFixFloor}%` }} />
      </div>
      {showScale ? (
        <div className="relative mt-xs h-4">
          <span className="absolute -translate-x-1/2 text-text-xs text-quaternary" style={{ left: `${recommendFloor}%` }}>
            {recommendFloor}
          </span>
          <span className="absolute -translate-x-1/2 text-text-xs text-quaternary" style={{ left: `${autoFixFloor}%` }}>
            {autoFixFloor}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('sweep rounded-md bg-tertiary', className)} />;
}

export function EmptyState({
  title, description, icon, action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-3xl py-7xl text-center">
      {icon ? (
        <div className="mb-xl flex h-11 w-11 items-center justify-center rounded-full border border-secondary bg-tertiary text-quaternary">
          {icon}
        </div>
      ) : null}
      <p className="text-text-sm font-medium text-primary">{title}</p>
      {description ? <p className="mt-xs max-w-md text-text-sm text-tertiary">{description}</p> : null}
      {action ? <div className="mt-xl">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('scroll-thin w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('border-b border-secondary px-xl py-lg text-text-xs font-medium uppercase tracking-wide text-quaternary', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('border-b border-secondary px-xl py-lg align-middle text-text-sm text-secondary', className)}>{children}</td>;
}

export function Tr({ children, className, href }: { children: React.ReactNode; className?: string; href?: string }) {
  if (href) {
    return (
      <tr className={cn('group cursor-pointer transition-colors hover:bg-primary-hover', className)}>
        {children}
      </tr>
    );
  }
  return <tr className={cn('transition-colors hover:bg-primary-hover', className)}>{children}</tr>;
}

/** Page-level heading used by every screen, so titles line up across the app. */
export function PageHeader({
  title, description, actions, breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="mb-3xl">
      {breadcrumb ? <div className="mb-md text-text-xs text-quaternary">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-xl">
        <div className="min-w-0">
          <h1 dir="auto" className="text-display-xs font-semibold tracking-tight text-primary">{title}</h1>
          {description ? <p dir="auto" className="mt-xs max-w-paragraph text-text-sm text-tertiary">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-md">{actions}</div> : null}
      </div>
    </div>
  );
}
