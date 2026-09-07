import React from 'react';
import { Link } from 'wouter';
import { useParams } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Fix, Investigation } from '@/lib/types';
import { Button, EmptyState, PageHeader, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives';
import { DiffViewer, PreventsCallout, PullRequestCard, ValidationPanel } from '@/components/fixes/fix-parts';
import { Icon } from '@/components/ui/icons';

export default function FixDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const { data: fix, initial } = usePolling<Fix>(`fixes/${params.id}`, 0);
  const { data: inv } = usePolling<Investigation>(
    fix ? `investigations/${fix.investigationId}` : null, 0,
  );

  if (initial) {
    return (
      <>
        <Skeleton className="mb-3xl h-10 w-2/3" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="mt-xl h-[420px]" />
      </>
    );
  }

  if (!fix) {
    return (
      <Panel>
        <EmptyState
          title="Fix not found"
          icon={<Icon.Wrench size={18} />}
          action={<Link href="/fixes"><Button>Back to Fix Center</Button></Link>}
        />
      </Panel>
    );
  }

  const held = fix.status === 'awaiting_review';

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-xs">
            <Link href="/fixes" className="hover:text-tertiary">Fix center</Link>
            <Icon.ChevronRight size={11} />
            <span className="font-mono">{fix.id}</span>
          </span>
        }
        title={t(fix.title)}
        description={fix.filePath}
        actions={
          <>
            <Link href={`/reasoning/${fix.investigationId}`}>
              <Button variant="secondary"><Icon.Brain size={13} /> Reasoning</Button>
            </Link>
            {held ? (
              <Link href="/reviews">
                <Button variant="primary"><Icon.Inbox size={13} /> Go to review</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <PreventsCallout fix={fix} className="mb-xl" />

      {held ? (
        <Panel className="mb-xl border-[color-mix(in_srgb,var(--decision-flag)_35%,transparent)] bg-decision-flag-bg">
          <div className="flex items-start gap-lg px-3xl py-xl">
            <span className="mt-xxs shrink-0 text-warning-primary"><Icon.Hand size={18} /></span>
            <div>
              <p className="text-text-sm font-semibold text-primary">
                This fix exists and has not been applied.
              </p>
              <p className="mt-xs max-w-paragraph text-text-sm leading-relaxed text-tertiary">
                The agent wrote the patch, validated everything it could, and then stopped. The unresolved
                check below is the reason — applying the fix without answering it could break production
                deploys, which is a worse outcome than the risk it removes.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-xl lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-xl">
          <Panel>
            <PanelHeader
              title="Why this fix, and not a different one"
              description="The alternatives the agent considered and rejected."
            />
            <div className="px-3xl py-xl">
              <p className="text-text-sm leading-relaxed text-secondary">{t(fix.rationale)}</p>
            </div>
          </Panel>

          <DiffViewer fix={fix} />
          <ValidationPanel fix={fix} />
        </div>

        <div className="space-y-xl lg:sticky lg:top-20">
          <PullRequestCard fix={fix} />

          {inv ? (
            <Panel>
              <PanelHeader title="Decision context" dense />
              <dl className="space-y-lg px-xl py-lg text-text-sm">
                <div className="flex items-baseline justify-between gap-lg">
                  <dt className="text-quaternary">Confidence</dt>
                  <dd className="tnum font-mono font-medium text-primary">{inv.confidence}%</dd>
                </div>
                <div className="flex items-baseline justify-between gap-lg">
                  <dt className="text-quaternary">Auto-fix floor</dt>
                  <dd className="tnum font-mono text-secondary">{inv.thresholds.autoFixFloor}%</dd>
                </div>
                <div className="flex items-baseline justify-between gap-lg">
                  <dt className="text-quaternary">Severity</dt>
                  <dd className="capitalize text-secondary">{inv.severity}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-lg">
                  <dt className="text-quaternary">Reasoning steps</dt>
                  <dd className="tnum font-mono text-secondary">{inv.steps.length}</dd>
                </div>
              </dl>
              <div className="border-t border-secondary px-xl py-lg">
                <Link
                  href={`/reasoning/${inv.id}`}
                  className="inline-flex items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline"
                >
                  Read the full chain <Icon.ArrowRight size={13} />
                </Link>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
