import React, { useMemo, useState } from 'react';
import type { DiffHunk, DiffLine, Fix } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { Button, Panel, PanelHeader } from '@/components/ui/primitives';

/**
 * Syntax highlighting for workflow YAML.
 *
 * Hand-rolled rather than pulled from a library: the diffs here are always CI
 * config, the token set is small, and a highlighter dependency would add far
 * more weight than the ~40 lines below. It degrades to plain text on anything
 * it does not recognise, which is the correct failure mode for a demo.
 */
const TOKEN = new RegExp(
  [
    '(#.*$)',                              // 1 comment
    '(\\$\\{\\{[^}]*\\}\\})',              // 2 expression
    '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')', // 3 string
    '^(\\s*-?\\s*)([A-Za-z_][\\w.-]*)(\\s*:)',          // 4,5,6 key
    '\\b(true|false|null|on|off)\\b',      // 7 literal
    '\\b(\\d+(?:\\.\\d+)?)\\b',            // 8 number
  ].join('|'),
  'gm',
);

function highlight(line: string): React.ReactNode {
  if (!line) return ' ';
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  TOKEN.lastIndex = 0;

  for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [full, comment, expr, str, keyIndent, keyName, keyColon, literal, num] = m;

    if (comment) {
      out.push(<span key={k++} className="text-[color:var(--syn-comment)] italic">{comment}</span>);
    } else if (expr) {
      out.push(<span key={k++} className="text-[color:var(--syn-expr)]">{expr}</span>);
    } else if (str) {
      out.push(<span key={k++} className="text-[color:var(--syn-string)]">{str}</span>);
    } else if (keyName) {
      out.push(keyIndent);
      out.push(<span key={k++} className="text-[color:var(--syn-key)]">{keyName}</span>);
      out.push(<span key={k++} className="text-quaternary">{keyColon}</span>);
    } else if (literal) {
      out.push(<span key={k++} className="text-[color:var(--syn-literal)]">{literal}</span>);
    } else if (num) {
      out.push(<span key={k++} className="text-[color:var(--syn-number)]">{num}</span>);
    } else {
      out.push(full);
    }
    last = m.index + full.length;
    if (m.index === TOKEN.lastIndex) TOKEN.lastIndex++; // zero-width guard
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

// ---------------------------------------------------------------------------

/** Pair up removed/added lines so both sides stay vertically aligned. */
interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'context') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    // Collect the run of removals then the run of additions and zip them, so a
    // 1-for-2 replacement still lines up instead of drifting.
    const removals: DiffLine[] = [];
    const additions: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'remove') removals.push(lines[i++]);
    while (i < lines.length && lines[i].type === 'add') additions.push(lines[i++]);
    const n = Math.max(removals.length, additions.length);
    for (let j = 0; j < n; j++) {
      rows.push({ left: removals[j] ?? null, right: additions[j] ?? null });
    }
  }
  return rows;
}

function Gutter({ n }: { n: number | null }) {
  return (
    <td className="tnum w-10 select-none border-e border-secondary px-md py-xxs text-end align-top font-mono text-text-xs text-quaternary">
      {n ?? ''}
    </td>
  );
}

function CodeCell({ line, side }: { line: DiffLine | null; side: 'left' | 'right' }) {
  if (!line) {
    return <td className="bg-[color:var(--bg-secondary)] px-lg py-xxs" />;
  }
  const removed = line.type === 'remove';
  const added = line.type === 'add';
  return (
    <td
      className={cn(
        'whitespace-pre px-lg py-xxs align-top font-mono text-text-xs leading-relaxed',
        removed && 'bg-error-primary',
        added && 'bg-success-primary',
      )}
    >
      <span className={cn('me-md select-none', removed ? 'text-error-primary' : added ? 'text-success-primary' : 'text-quaternary')}>
        {removed ? '−' : added ? '+' : ' '}
      </span>
      {highlight(line.content)}
    </td>
  );
}

function SplitHunk({ hunk }: { hunk: DiffHunk }) {
  const rows = useMemo(() => toSplitRows(hunk.lines), [hunk]);
  return (
    <div>
      <div className="border-b border-secondary bg-secondary px-lg py-xs font-mono text-text-xs text-quaternary">
        {hunk.header}
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <Gutter n={row.left?.oldLine ?? null} />
              <CodeCell line={row.left} side="left" />
              <Gutter n={row.right?.newLine ?? null} />
              <CodeCell line={row.right} side="right" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnifiedHunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <div>
      <div className="border-b border-secondary bg-secondary px-lg py-xs font-mono text-text-xs text-quaternary">
        {hunk.header}
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {hunk.lines.map((line, i) => (
            <tr key={i} className={cn(line.type === 'add' && 'bg-success-primary', line.type === 'remove' && 'bg-error-primary')}>
              <Gutter n={line.oldLine} />
              <Gutter n={line.newLine} />
              <td className="whitespace-pre px-lg py-xxs align-top font-mono text-text-xs leading-relaxed">
                <span className={cn('me-md select-none', line.type === 'add' ? 'text-success-primary' : line.type === 'remove' ? 'text-error-primary' : 'text-quaternary')}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                </span>
                {highlight(line.content)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Before / after viewer.
 *
 * Defaults to split, because "before and after" is the question a reviewer is
 * actually asking. Unified stays available for narrow screens and for anyone
 * who reads diffs the git way.
 */
export function BeforeAfterDiff({ fix, defaultMode = 'split' }: { fix: Fix; defaultMode?: 'split' | 'unified' }) {
  const [mode, setMode] = useState<'split' | 'unified'>(defaultMode);
  const added = fix.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'add').length;
  const removed = fix.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'remove').length;

  if (fix.hunks.length === 0) {
    return (
      <Panel className="border-dashed">
        <PanelHeader
          dense
          title={<span className="font-mono text-text-xs">{fix.filePath}</span>}
        />
        <p className="px-xl py-lg text-text-sm leading-relaxed text-tertiary">
          No patch was generated for this finding. The remedy is described rather than applied, because
          the safe change depends on runtime behaviour the agent cannot observe.
        </p>
      </Panel>
    );
  }

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
            <div className="ms-md flex items-center rounded-md border border-secondary bg-secondary p-xxs">
              {(['split', 'unified'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded px-md py-xxs text-text-xs font-medium capitalize transition-colors',
                    mode === m ? 'bg-primary text-primary shadow-xs' : 'text-quaternary hover:text-tertiary',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        }
      />

      {mode === 'split' ? (
        <div className="grid grid-cols-2 border-b border-secondary bg-secondary text-text-xs font-medium uppercase tracking-wider text-quaternary">
          <span className="border-e border-secondary px-xl py-xs">Before</span>
          <span className="px-xl py-xs">After</span>
        </div>
      ) : null}

      <div className="scroll-thin overflow-x-auto">
        {fix.hunks.map((hunk, i) =>
          mode === 'split'
            ? <SplitHunk key={i} hunk={hunk} />
            : <UnifiedHunk key={i} hunk={hunk} />)}
      </div>
    </Panel>
  );
}
