'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import type { Pipeline } from '@/lib/types';
import { EmptyState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/** Extra context the gateway does not yet return per-secret. Kept beside the
 *  view rather than invented inside it, so it is obvious this is fixture data. */
const secretMeta: Record<string, { rotatedDaysAgo: number; kind: string; production: boolean }> = {
  PROD_DEPLOY_KEY: { rotatedDaysAgo: 38, kind: 'Static credential', production: true },
  AWS_ROLE_ARN: { rotatedDaysAgo: 12, kind: 'Role reference (OIDC)', production: true },
  SLACK_WEBHOOK: { rotatedDaysAgo: 190, kind: 'Webhook URL', production: false },
  NPM_TOKEN: { rotatedDaysAgo: 74, kind: 'Registry token', production: false },
  GITHUB_TOKEN: { rotatedDaysAgo: 0, kind: 'Ephemeral, per-run', production: false },
  DB_MIGRATION_KEY: { rotatedDaysAgo: 214, kind: 'Static credential', production: true },
};

export default function PipelineSecretsPage() {
  const params = useParams<{ id: string }>();
  const { data: pipeline, initial } = usePolling<Pipeline>(`pipelines/${params.id}`, 0);

  if (initial || !pipeline) return <Skeleton className="h-[320px]" />;

  if (pipeline.secretsUsed.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="This pipeline reads no secrets"
          description="Nothing in the workflow references a repository or organisation secret."
          icon={<Icon.Key size={18} />}
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-xl">
      <Panel>
        <PanelHeader
          title="Secrets and access"
          description="Which jobs can read which credentials. A secret inherits the risk of every job that can read it."
        />
        <ul className="divide-y divide-[color:var(--border-secondary)]">
          {pipeline.secretsUsed.map((secret) => {
            const meta = secretMeta[secret];
            const readers = pipeline.jobs.filter((j) => j.secrets.includes(secret));
            const stale = meta && meta.rotatedDaysAgo > 180;
            return (
              <li key={secret} className="px-3xl py-xl">
                <div className="flex flex-wrap items-center gap-md">
                  <span className="text-quaternary"><Icon.Key size={14} /></span>
                  <span className="font-mono text-text-sm font-medium text-primary">{secret}</span>
                  {meta?.production ? (
                    <span className="rounded-full border border-error px-md py-xxs text-text-xs font-medium text-error-primary">
                      production
                    </span>
                  ) : null}
                  {stale ? (
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary px-md py-xxs text-text-xs font-medium text-warning-primary">
                      not rotated in {meta.rotatedDaysAgo} days
                    </span>
                  ) : null}
                  <span className="ms-auto font-mono text-text-xs text-quaternary">
                    {meta?.kind ?? 'Unknown kind'}
                  </span>
                </div>

                <p className="mt-md text-text-sm text-tertiary">
                  Readable by{' '}
                  {readers.length === 0 ? (
                    <span className="text-quaternary">no job in this pipeline</span>
                  ) : (
                    readers.map((j, i) => (
                      <React.Fragment key={j.id}>
                        {i > 0 ? ', ' : ''}
                        <span className="font-mono text-secondary">{j.name}</span>
                      </React.Fragment>
                    ))
                  )}
                  {readers.some((j) => j.environment) ? (
                    <span className="text-error-primary"> — one of which deploys to production.</span>
                  ) : '.'}
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="How secret exposure is scored" />
        <div className="space-y-lg px-3xl py-xl text-text-sm leading-relaxed text-tertiary">
          <p>
            A secret is not risky on its own. It becomes risky in proportion to what can read it and what
            those readers can do — which is why this view is derived from the job graph rather than from a
            list of secret names.
          </p>
          <p>
            Finding <Link href="/findings/PG-1047" className="text-brand-secondary hover:underline">PG-1047</Link>{' '}
            on this repository is an example: the credential itself is fine, but a debug step in the same
            job prints the whole environment, so the credential leaks into logs that anyone with read access
            can open.
          </p>
        </div>
      </Panel>
    </div>
  );
}
