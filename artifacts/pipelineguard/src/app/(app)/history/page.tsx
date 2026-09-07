import React from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { HistoricalIncident, LearnedPattern } from '@/lib/mock/patterns';
import { PageHeader, Panel, PanelHeader, Skeleton, StatTile } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, formatDateTime, relativeTime } from '@/lib/utils';

const categoryLabels: Record<LearnedPattern['category'], string> = {
  permissions: 'Permissions',
  supply_chain: 'Supply chain',
  secrets: 'Secrets',
  integrity: 'Integrity',
  policy: 'Policy',
};

export default function HistoryPage() {
  const { t } = useLocale();
  const { data: patterns, initial } = usePolling<LearnedPattern[]>('patterns', 0);
  const { data: incidents } = usePolling<HistoricalIncident[]>('incidents', 0);

  const list = patterns ?? [];
  const totalObs = list.reduce((a, p) => a + p.observations, 0);
  const totalConf = list.reduce((a, p) => a + p.confirmations, 0);
  const hitRate = totalObs ? ((totalConf / totalObs) * 100).toFixed(0) : '—';

  return (
    <>
      <PageHeader
        title="History and learning"
        description="What the agent generalised from past pipeline runs, and the evidence each generalisation rests on. A pattern with a small sample is labelled as such rather than presented as knowledge."
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Learned patterns" value={list.length} icon={<Icon.Spark size={15} />} />
        <StatTile label="Observations" value={totalObs} sub="Historical changes matched" icon={<Icon.History size={15} />} />
        <StatTile label="Pattern hit rate" value={`${hitRate}%`} sub="Predicted outcome occurred" tone="good" icon={<Icon.Activity size={15} />} />
        <StatTile label="Incidents on record" value={incidents?.length ?? 0} sub="Root-caused and fed back in" icon={<Icon.Alert size={15} />} />
      </div>

      <Panel className="mb-xl">
        <PanelHeader
          title="Learned patterns"
          description="Each pattern shows the sample it was learned from. Patterns cited by an investigation link straight to the reasoning that used them."
        />
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-64" /></div>
        ) : (
          <ul className="divide-y divide-[color:var(--border-secondary)]">
            {list.map((p) => {
              const rate = (p.confirmations / p.observations) * 100;
              const smallSample = p.observations < 5;
              return (
                <li key={p.id} className="px-3xl py-xl">
                  <div className="flex flex-wrap items-center gap-md">
                    <span className="font-mono text-text-xs text-brand-secondary">{p.id}</span>
                    <span className="text-text-sm font-semibold text-primary">{t(p.name)}</span>
                    <span className="rounded-md border border-secondary bg-tertiary px-md py-xxs text-text-xs text-tertiary">
                      {categoryLabels[p.category]}
                    </span>
                    {smallSample ? (
                      <span className="rounded-md border border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary px-md py-xxs text-text-xs font-medium text-warning-primary">
                        small sample
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-md max-w-paragraph text-text-sm leading-relaxed text-tertiary">
                    {t(p.statement)}
                  </p>

                  <div className="mt-lg flex flex-wrap items-center gap-xl">
                    <div className="flex items-center gap-md">
                      <span className="text-text-xs text-quaternary">Held in</span>
                      <span className="tnum font-mono text-text-sm font-medium text-primary">
                        {p.confirmations} / {p.observations}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-quaternary">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${rate}%`, background: rate >= 80 ? 'var(--fg-success-primary)' : 'var(--sev-medium)' }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-text-xs text-quaternary">
                      {p.windowDays}d window · last matched {relativeTime(p.lastMatched)}
                    </span>
                    {p.citedBy.length > 0 ? (
                      <div className="ms-auto flex flex-wrap items-center gap-md">
                        <span className="text-text-xs text-quaternary">Cited by</span>
                        {p.citedBy.map((id) => (
                          <Link
                            key={id}
                            href={`/reasoning/${id}`}
                            className="rounded-md border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-tertiary transition-colors hover:border-primary hover:text-secondary"
                          >
                            {id}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="ms-auto text-text-xs text-quaternary">Not yet cited</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-xl lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Panel>
          <PanelHeader
            title="Historical incidents"
            description="Every incident is root-caused and turned into either a pattern or a policy. This is the loop that makes the next investigation better than the last."
          />
          <ol className="reasoning-rail relative px-3xl py-xl">
            {(incidents ?? []).map((inc) => (
              <li key={inc.id} className="relative ps-5xl pb-3xl last:pb-0">
                <span className="absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-error bg-error-primary text-error-primary">
                  <Icon.Alert size={13} />
                </span>
                <div className="flex flex-wrap items-center gap-md">
                  <span className="font-mono text-text-xs text-error-primary">{inc.id}</span>
                  <span className="text-text-sm font-semibold text-primary">{t(inc.title)}</span>
                </div>
                <p className="mt-xxs font-mono text-text-xs text-quaternary">
                  {formatDateTime(inc.date)} · {inc.repo} · {inc.recoveryHours}h to recover
                </p>
                <p className="mt-md max-w-paragraph text-text-sm leading-relaxed text-tertiary">
                  {t(inc.rootCause)}
                </p>
                {inc.patternId ? (
                  <p className="mt-md text-text-xs text-quaternary">
                    Generalised into pattern{' '}
                    <span className="font-mono text-brand-secondary">{inc.patternId}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel>
          <PanelHeader title="How a pattern becomes evidence" />
          <ol className="space-y-lg px-3xl py-xl">
            {[
              ['Observe', 'Every historical run, config diff and outcome is indexed — not just failures. Clean runs are what make a pattern falsifiable.'],
              ['Generalise', 'A candidate pattern needs a stated antecedent, a predicted outcome, and a sample. Patterns under five observations are labelled small-sample and weighted down.'],
              ['Cite', 'When a pattern matches a live change, the historical step of the reasoning chain cites it by id, with the sample attached.'],
              ['Falsify', 'If the predicted outcome does not occur, the confirmation ratio drops and the pattern contributes less. Nothing is permanently true.'],
            ].map(([title, body], i) => (
              <li key={i} className="flex gap-lg">
                <span className="mt-xxs flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-secondary bg-tertiary font-mono text-text-xs text-tertiary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-text-sm font-medium text-primary">{title}</p>
                  <p className="mt-xxs text-text-sm leading-relaxed text-tertiary">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
