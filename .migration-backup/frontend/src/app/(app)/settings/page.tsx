'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale, useSource, useTheme } from '@/lib/providers';
import { PageHeader, Panel, PanelHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/lib/api/client';

function Row({
  title, description, children,
}: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-xl px-3xl py-xl">
      <div className="min-w-0 max-w-paragraph">
        <p className="text-text-sm font-medium text-primary">{title}</p>
        <p className="mt-xxs text-text-sm leading-relaxed text-tertiary">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 rounded-full border transition-colors',
        on ? 'border-transparent bg-brand-solid' : 'border-primary bg-quaternary',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-4 w-4 rounded-full bg-white transition-transform',
          on ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center rounded-md border border-secondary bg-secondary p-xxs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-lg py-xs text-text-sm font-medium transition-colors',
            value === o.value ? 'bg-primary text-primary shadow-xs' : 'text-quaternary hover:text-tertiary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const { mode, setMode } = useSource();

  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const [autoFixProd, setAutoFixProd] = useState(false);
  const [notifySlack, setNotifySlack] = useState(true);
  const [notifyRefusals, setNotifyRefusals] = useState(true);
  const [autoFixFloor, setAutoFixFloor] = useState(90);
  const [recommendFloor, setRecommendFloor] = useState(45);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Organisation, agent and interface preferences."
      />

      <div className="space-y-xl">
        <Panel>
          <PanelHeader title="Interface" description="Applies to this browser only." />
          <div className="divide-y divide-[color:var(--border-secondary)]">
            <Row
              title="Appearance"
              description="Dark is the default. The palette comes from the Untitled UI Pro library, so both themes are the design system values rather than a generated inversion."
            >
              <Segmented
                value={theme}
                onChange={setTheme}
                options={[{ value: 'dark' as const, label: 'Dark' }, { value: 'light' as const, label: 'Light' }]}
              />
            </Row>
            <Row
              title="Language"
              description="Switching to Urdu translates the agent reasoning itself — every claim, every supporting bullet, and every fix rationale — not just the interface labels."
            >
              <Segmented
                value={locale}
                onChange={setLocale}
                options={[{ value: 'en' as const, label: 'English' }, { value: 'ur' as const, label: 'اردو' }]}
              />
            </Row>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Agent autonomy"
            description="What the agent may do without asking. Policies can still veto any of this — see the policy dashboard."
          />
          <div className="divide-y divide-[color:var(--border-secondary)]">
            <Row
              title="Autonomous fixes"
              description="Allow the agent to apply and merge a fix when confidence clears the floor and the blast radius excludes production and secrets."
            >
              <Toggle on={autoFixEnabled} onChange={setAutoFixEnabled} />
            </Row>
            <Row
              title="Autonomous fixes on production pipelines"
              description="Blocked by policy PG-DEP-002 regardless of this setting. Shown here so the constraint is visible rather than silently absent."
            >
              <div className="flex items-center gap-md">
                <span className="font-mono text-text-xs text-quaternary">policy-locked</span>
                <Toggle on={autoFixProd} onChange={() => {}} />
              </div>
            </Row>
            <Row
              title="Auto-fix confidence floor"
              description="Below this, the agent drafts a fix but will not apply it. Raising it makes the agent more conservative, not more accurate."
            >
              <div className="flex items-center gap-lg">
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={autoFixFloor}
                  onChange={(e) => setAutoFixFloor(Number(e.target.value))}
                  className="w-40 accent-[color:var(--fg-brand-primary)]"
                />
                <span className="tnum w-10 text-end font-mono text-text-sm text-primary">{autoFixFloor}%</span>
              </div>
            </Row>
            <Row
              title="Recommendation floor"
              description="Below this, the agent publishes nothing at all — no fix, no risk score — and escalates a question instead. This is what produces a refusal."
            >
              <div className="flex items-center gap-lg">
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={recommendFloor}
                  onChange={(e) => setRecommendFloor(Number(e.target.value))}
                  className="w-40 accent-[color:var(--fg-brand-primary)]"
                />
                <span className="tnum w-10 text-end font-mono text-text-sm text-primary">{recommendFloor}%</span>
              </div>
            </Row>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Notifications" />
          <div className="divide-y divide-[color:var(--border-secondary)]">
            <Row title="Post to Slack" description="Send critical findings and held fixes to #security-alerts.">
              <Toggle on={notifySlack} onChange={setNotifySlack} />
            </Row>
            <Row
              title="Notify on refusals"
              description="A refusal means the agent found something it could not settle. Silence on refusals is how ambiguous changes ship unnoticed."
            >
              <Toggle on={notifyRefusals} onChange={setNotifyRefusals} />
            </Row>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Gateway" description="Where the dashboard reads from." />
          <div className="divide-y divide-[color:var(--border-secondary)]">
            <Row
              title="API base URL"
              description="Set NEXT_PUBLIC_API_BASE to point at the FastAPI gateway. Unset, the bundled mock gateway serves the same contract."
            >
              <code className="rounded-md border border-secondary bg-secondary px-lg py-md font-mono text-text-xs text-secondary">
                {API_BASE}
              </code>
            </Row>
            <Row
              title="Data source"
              description="Replay serves the recorded cassette through the same code path at the same latency. Use it if the live gateway is unreliable during a demo."
            >
              <Segmented
                value={mode}
                onChange={setMode}
                options={[{ value: 'live' as const, label: 'Live' }, { value: 'replay' as const, label: 'Replay' }]}
              />
            </Row>
          </div>
          <div className="border-t border-secondary px-3xl py-lg">
            <Link href="/replay" className="inline-flex items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline">
              Replay center <Icon.ArrowRight size={13} />
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
