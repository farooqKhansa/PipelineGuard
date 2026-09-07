import React, { useState } from 'react';
import type { DiffHunk, Fix, ValidationCheck } from '@/lib/types';
import { cn, formatDuration } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { Button, Panel, PanelHeader } from '@/components/ui/primitives';
import { useLocale } from '@/lib/providers';

/**
 * "What this prevents".
 *
 * Placed ABOVE the diff, not below it, and given more visual weight than the
 * code. The brief is right: judges — and on-call engineers at 2am — remember
 * consequences, not diffs. The diff is the evidence; this is the claim.
 */
export function PreventsCallout({ fix, className }: { fix: Fix; className?: string }) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        'rounded-xl border border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary px-3xl py-xl',
        className,
      )}
    >
      <div className="flex items-start gap-lg">
        <span className="mt-xxs shrink-0 text-success-primary">
          <Icon.ShieldCheck size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-text-xs font-semibold uppercase tracking-wider text-success-primary">
            What this prevents
          </p>
          <p dir="auto" className="mt-xs text-text-md font-medium leading-relaxed text-primary">
            {t(fix.prevents)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffHunk['lines'][number] }) {
  const add = line.type === 'add';
  const remove = line.type === 'remove';
  return (
    <tr
      className={cn(
        add && 'bg-success-primary',
        remove && 'bg-error-primary',
      )}
    >
      <td className="tnum select-none border-e border-secondary px-md py-xxs text-end font-mono text-text-xs text-quaternary">
        {line.oldLine ?? ''}
      </td>
      <td className="tnum select-none border-e border-secondary px-md py-xxs text-end font-mono text-text-xs text-quaternary">
        {line.newLine ?? ''}
      </td>
      <td
        className={cn(
          'w-4 select-none px-md py-xxs text-center font-mono text-text-xs',
          add && 'text-success-primary',
          remove && 'text-error-primary',
          !add && !remove && 'text-quaternary',
        )}
      >
        {add ? '+' : remove ? '−' : ' '}
      </td>
      <td
        className={cn(
          'whitespace-pre px-lg py-xxs font-mono text-text-xs leading-relaxed',
          add && 'text-primary',
          remove && 'text-secondary line-through decoration-[color-mix(in_srgb,var(--fg-error-primary)_40%,transparent)]',
          !add && !remove && 'text-tertiary',
        )}
      >
        {line.content || ' '}
      </td>
    </tr>
  );
}

export function DiffViewer({ fix }: { fix: Fix }) {
  const [expanded, setExpanded] = useState(true);
  const added = fix.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'add').length;
  const removed = fix.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'remove').length;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        dense
        title={
          <span className="flex items-center gap-md font-mono text-text-xs">
            <Icon.File size={13} />
            {fix.filePath}
          </span>
        }
        actions={
          <>
            <span className="tnum font-mono text-text-xs text-success-primary">+{added}</span>
            <span className="tnum font-mono text-text-xs text-error-primary">−{removed}</span>
            <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
          </>
        }
      />
      {expanded ? (
        <div className="scroll-thin overflow-x-auto">
          {fix.hunks.map((hunk, i) => (
            <div key={i}>
              <div dir="auto" className="border-b border-secondary bg-secondary px-lg py-xs font-mono text-text-xs text-quaternary">
                {hunk.header}
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {hunk.lines.map((line, j) => (
                    <DiffRow key={j} line={line} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

const checkStyles: Record<ValidationCheck['status'], { icon: React.ReactNode; cls: string; label: string }> = {
  passed: { icon: <Icon.Check size={13} />, cls: 'text-success-primary', label: 'Passed' },
  failed: { icon: <Icon.X size={13} />, cls: 'text-error-primary', label: 'Failed' },
  skipped: { icon: <Icon.Pause size={13} />, cls: 'text-quaternary', label: 'Skipped' },
  not_applicable: { icon: <Icon.Dot size={10} />, cls: 'text-quaternary', label: 'N/A' },
};

/**
 * Validation.
 *
 * A failed check is rendered as prominently as a passing one. On the flagged
 * scenario the failing row *is* the reason the fix was not applied, so hiding
 * it behind a summary would destroy the whole argument.
 */
export function ValidationPanel({ fix }: { fix: Fix }) {
  const { t } = useLocale();
  const v = fix.validation;
  const failed = v.checks.filter((c) => c.status === 'failed').length;

  return (
    <Panel>
      <PanelHeader
        title="Fix validation"
        description={t(v.method)}
        actions={
          <span
            className={cn(
              'rounded-full border px-lg py-xs text-text-xs font-medium',
              v.verified
                ? 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary'
                : 'border-[color-mix(in_srgb,var(--decision-flag)_35%,transparent)] bg-warning-primary text-warning-primary',
            )}
          >
            {v.verified ? 'Verified' : `Partially verified · ${failed} unresolved`}
          </span>
        }
      />
      <ul className="divide-y divide-[color:var(--border-secondary)]">
        {v.checks.map((c, i) => {
          const s = checkStyles[c.status];
          return (
            <li key={i} className="flex items-start gap-lg px-3xl py-lg">
              <span className={cn('mt-xxs shrink-0', s.cls)}>{s.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-md">
                  <span className="text-text-sm font-medium text-primary">{c.name}</span>
                  <span className={cn('text-text-xs font-medium', s.cls)}>{s.label}</span>
                  {c.durationMs > 0 ? (
                    <span className="tnum ms-auto font-mono text-text-xs text-quaternary">
                      {formatDuration(c.durationMs)}
                    </span>
                  ) : null}
                </div>
                <p dir="auto" className="mt-xxs text-text-sm leading-relaxed text-tertiary">{t(c.detail)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function PullRequestCard({ fix }: { fix: Fix }) {
  const { t } = useLocale();
  const pr = fix.pullRequest;
  if (!pr) return null;

  const stateStyles: Record<string, string> = {
    draft: 'border-secondary bg-tertiary text-tertiary',
    open: 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary',
    merged: 'border-brand bg-brand-primary-alt text-brand-secondary',
    closed: 'border-secondary bg-tertiary text-tertiary',
  };

  return (
    <Panel>
      <PanelHeader
        title="Pull request"
        description={`${pr.branch} → ${pr.baseBranch}`}
        actions={
          <span className={cn('rounded-full border px-lg py-xs text-text-xs font-medium capitalize', stateStyles[pr.state])}>
            {pr.state}
          </span>
        }
      />
      <div className="px-3xl py-xl">
        <div className="flex flex-wrap items-center gap-lg">
          <span className="font-mono text-text-sm text-quaternary">#{pr.number}</span>
          <span className="min-w-0 flex-1 text-text-sm font-medium text-primary">{pr.title}</span>
        </div>
        <div className="mt-md flex flex-wrap items-center gap-lg font-mono text-text-xs text-quaternary">
          <span className="text-success-primary">+{pr.additions}</span>
          <span className="text-error-primary">−{pr.deletions}</span>
          <span>{pr.filesChanged} file{pr.filesChanged === 1 ? '' : 's'}</span>
          <span>reviewers: {pr.reviewers.join(', ') || 'none'}</span>
        </div>
        <pre dir="auto" className="scroll-thin mt-xl max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-secondary bg-secondary p-xl font-sans text-text-sm leading-relaxed text-secondary">
          {t(pr.body)}
        </pre>
      </div>
    </Panel>
  );
}
