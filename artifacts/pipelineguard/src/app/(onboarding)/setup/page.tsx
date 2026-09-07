import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button, Panel, PanelHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type Mode = 'observe' | 'assist' | 'autonomous';

const modes: Array<{ id: Mode; title: string; body: string; detail: string[] }> = [
  {
    id: 'observe',
    title: 'Observe only',
    body: 'The agent investigates and explains, but never writes.',
    detail: [
      'Opens no pull requests and changes nothing',
      'Still produces full reasoning chains and findings',
      'Recommended for the first week, while it learns your baseline',
    ],
  },
  {
    id: 'assist',
    title: 'Draft and hold',
    body: 'The agent writes fixes and opens them as drafts for a human to merge.',
    detail: [
      'Opens draft pull requests with the reasoning in the body',
      'Never merges anything itself',
      'Every fix still states what it prevents and how far it was validated',
    ],
  },
  {
    id: 'autonomous',
    title: 'Act on low-risk findings',
    body: 'The agent may merge a fix when it clears the confidence floor and the blast radius excludes production and secrets.',
    detail: [
      'Applies only behaviour-preserving, reversible changes',
      'Production pipelines are excluded by policy at any confidence',
      'Everything else is drafted and held, exactly as in Draft and hold',
    ],
  },
];

export default function SetupPage() {
  const [mode, setMode] = useState<Mode>('assist');
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Panel>
        <div className="px-3xl py-6xl text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--fg-success-primary)_35%,transparent)] bg-success-primary text-success-primary">
            <Icon.Check size={22} />
          </span>
          <h2 className="mt-xl text-display-xs font-semibold tracking-tight text-primary">
            PipelineGuard is watching
          </h2>
          <p className="mx-auto mt-md max-w-paragraph text-text-sm leading-relaxed text-tertiary">
            It is indexing 180 days of pipeline history to learn your baseline. The first investigations
            usually appear within a few minutes of the next pipeline run. Until the baseline is built, the
            agent deliberately reports lower confidence — it has less history to reason from.
          </p>

          <div className="mx-auto mt-3xl grid max-w-lg gap-md sm:grid-cols-3">
            {[
              ['6', 'repositories'],
              ['11', 'workflows'],
              ['180', 'days indexed'],
            ].map(([n, label]) => (
              <div key={label} className="rounded-lg border border-secondary bg-secondary px-lg py-md">
                <p className="tnum text-text-xl font-semibold text-primary">{n}</p>
                <p className="text-text-xs text-quaternary">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3xl flex flex-wrap justify-center gap-md">
            <Link href="/overview"><Button variant="primary">Go to dashboard</Button></Link>
            <Link href="/demo"><Button variant="secondary"><Icon.Play size={13} /> See the three-outcome demo</Button></Link>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-xl">
      <Panel>
        <PanelHeader
          title="How much may the agent do on its own?"
          description="You can change this at any time. Policies can restrict it further, and always override this setting."
        />
        <ul className="space-y-md p-3xl">
          {modes.map((m) => {
            const on = mode === m.id;
            return (
              <li key={m.id}>
                <button
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'w-full rounded-lg border px-xl py-lg text-start transition-colors',
                    on ? 'border-brand bg-brand-primary-alt' : 'border-secondary bg-primary hover:border-primary',
                  )}
                >
                  <div className="flex items-center gap-md">
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        on ? 'border-[color:var(--fg-brand-primary)]' : 'border-primary',
                      )}
                    >
                      {on ? <span className="h-2 w-2 rounded-full bg-[color:var(--fg-brand-primary)]" /> : null}
                    </span>
                    <span className="text-text-sm font-semibold text-primary">{m.title}</span>
                    {m.id === 'assist' ? (
                      <span className="rounded-full border border-secondary bg-tertiary px-md py-xxs text-text-xs text-tertiary">
                        recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-xs ps-7xl text-text-sm text-tertiary">{m.body}</p>
                  {on ? (
                    <ul className="mt-md space-y-xs ps-7xl">
                      {m.detail.map((d) => (
                        <li key={d} className="flex gap-md text-text-xs leading-relaxed text-tertiary">
                          <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[color:var(--fg-quaternary)]" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          title="Baseline policies"
          description="Enabled by default. These are the rules that make autonomy safe to grant at all."
        />
        <ul className="divide-y divide-[color:var(--border-secondary)]">
          {[
            ['No autonomous permission changes on production', 'Blocks the agent from touching token permissions on any production-bound pipeline, at any confidence.'],
            ['Refuse below the recommendation floor', 'Below 45% confidence, or when two hypotheses are within 15 points, the agent publishes nothing and escalates a question.'],
            ['Third-party actions must be SHA-pinned', 'Warns on any action referenced by a mutable tag.'],
            ['No write-all token permissions', 'Blocks permissions: write-all at workflow or job level.'],
          ].map(([title, body]) => (
            <li key={title} className="flex items-start gap-lg px-3xl py-lg">
              <span className="mt-xxs shrink-0 text-success-primary"><Icon.Check size={14} /></span>
              <div>
                <p className="text-text-sm font-medium text-primary">{title}</p>
                <p className="mt-xxs text-text-sm leading-relaxed text-tertiary">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="flex justify-between gap-md">
        <Link href="/connect"><Button variant="ghost">Back</Button></Link>
        <Button variant="primary" onClick={() => setDone(true)}>
          Finish setup <Icon.ArrowRight size={13} />
        </Button>
      </div>
    </div>
  );
}
