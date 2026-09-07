'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Investigation } from '@/lib/types';
import { Button, EmptyState, PageHeader, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives';
import { ReasoningChain } from '@/components/reasoning/reasoning-chain';
import {
  EvidenceGapList, HypothesisPanel, SimilarChangesPanel, VerdictCard,
} from '@/components/reasoning/investigation-parts';
import { DiffViewer, PreventsCallout, PullRequestCard, ValidationPanel } from '@/components/fixes/fix-parts';
import { Icon } from '@/components/ui/icons';

export default function InvestigationPage() {
  const params = useParams<{ id: string }>();
  const { t, locale } = useLocale();
  const [replaying, setReplaying] = useState(false);
  const { data: inv, initial, error } = usePolling<Investigation>(`investigations/${params.id}`, 0);

  if (initial) {
    return (
      <>
        <Skeleton className="mb-3xl h-10 w-2/3" />
        <Skeleton className="h-[280px]" />
        <Skeleton className="mt-xl h-[520px]" />
      </>
    );
  }

  if (!inv || error) {
    return (
      <Panel>
        <EmptyState
          title="Investigation not found"
          description={error ?? 'No investigation exists with that id.'}
          icon={<Icon.Search size={18} />}
          action={<Link href="/reasoning"><Button>Back to reasoning center</Button></Link>}
        />
      </Panel>
    );
  }

  const fix = inv.fix;

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-xs">
            <Link href="/reasoning" className="hover:text-tertiary">AI reasoning</Link>
            <Icon.ChevronRight size={11} />
            <span className="font-mono">{inv.id}</span>
          </span>
        }
        title={t(inv.title)}
        description={`Investigation opened on commit ${inv.commit} in ${inv.repo}.`}
        actions={
          <>
            <Button
              variant={replaying ? 'primary' : 'secondary'}
              onClick={() => setReplaying((r) => !r)}
            >
              <Icon.Play size={13} />
              {replaying ? 'Replaying…' : 'Replay reasoning'}
            </Button>
            <Link href={`/pipelines/${inv.pipelineId}/graph`}>
              <Button variant="secondary"><Icon.Graph size={13} /> View graph</Button>
            </Link>
          </>
        }
      />

      <VerdictCard investigation={inv} />

      <div className="mt-xl grid gap-xl lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Panel>
          <PanelHeader
            title="Reasoning chain"
            description="Each step states a claim, the support for it, and how it moved confidence. Every citation links to the artefact it came from."
            actions={
              <span className="font-mono text-text-xs text-quaternary">
                {inv.steps.length} steps
              </span>
            }
          />
          <div className="px-3xl py-3xl">
            <ReasoningChain
              key={`${replaying}-${locale}`}
              investigation={inv}
              play={replaying}
              speed={2.5}
            />
          </div>
        </Panel>

        <div className="space-y-xl lg:sticky lg:top-20">
          {fix ? (
            <>
              <PreventsCallout fix={fix} />
              <Panel>
                <PanelHeader
                  title="Generated fix"
                  description={t(fix.title)}
                  actions={
                    <Link href={`/fixes/${fix.id}`} className="text-text-xs font-medium text-brand-secondary hover:underline">
                      Open in Fix Center
                    </Link>
                  }
                />
                <div className="px-3xl py-xl">
                  <p className="text-text-sm leading-relaxed text-tertiary">{t(fix.rationale)}</p>
                </div>
              </Panel>
            </>
          ) : (
            <Panel className="border-dashed">
              <PanelHeader title="No fix was generated" />
              <div className="px-3xl py-xl">
                <p className="text-text-sm leading-relaxed text-tertiary">
                  This is deliberate, not a gap. Drafting a fix here would require assuming which of two
                  competing readings is correct. The agent escalated a question instead of publishing a guess.
                </p>
                <Link href="/reviews" className="mt-lg inline-flex items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline">
                  See the escalation <Icon.ArrowRight size={13} />
                </Link>
              </div>
            </Panel>
          )}

          <SimilarChangesPanel changes={inv.similarChanges} />
        </div>
      </div>

      {inv.hypotheses.length > 0 ? (
        <div className="mt-xl">
          <HypothesisPanel hypotheses={inv.hypotheses} />
        </div>
      ) : null}

      {inv.gaps.length > 0 ? (
        <div className="mt-xl">
          <EvidenceGapList gaps={inv.gaps} />
        </div>
      ) : null}

      {fix ? (
        <div className="mt-xl space-y-xl">
          <DiffViewer fix={fix} />
          <div className="grid gap-xl lg:grid-cols-2 lg:items-start">
            <ValidationPanel fix={fix} />
            <PullRequestCard fix={fix} />
          </div>
        </div>
      ) : null}
    </>
  );
}
