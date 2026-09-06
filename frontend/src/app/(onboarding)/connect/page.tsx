'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Panel, PanelHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface Connector {
  id: string;
  name: string;
  detail: string;
  scopes: string[];
  required: boolean;
  icon: React.ReactNode;
}

const groups: Array<{ title: string; description: string; items: Connector[] }> = [
  {
    title: 'Source control',
    description: 'Required. PipelineGuard reads workflow files and history, and opens pull requests for fixes.',
    items: [
      { id: 'github', name: 'GitHub', detail: 'Repositories and Actions workflows', required: true, icon: <Icon.Repo size={16} />, scopes: ['contents: read', 'actions: read', 'pull_requests: write', 'checks: write'] },
      { id: 'gitlab', name: 'GitLab', detail: 'Projects and GitLab CI', required: false, icon: <Icon.Branch size={16} />, scopes: ['read_api', 'read_repository'] },
      { id: 'bitbucket', name: 'Bitbucket', detail: 'Repositories and Pipelines', required: false, icon: <Icon.Repo size={16} />, scopes: ['repository', 'pullrequest:write'] },
    ],
  },
  {
    title: 'CI provider',
    description: 'Where your pipelines actually run. Needed to read past run outcomes, which is what the historical reasoning step depends on.',
    items: [
      { id: 'gha', name: 'GitHub Actions', detail: 'Detected automatically with GitHub', required: false, icon: <Icon.Pipeline size={16} />, scopes: ['workflows: read', 'runs: read'] },
      { id: 'jenkins', name: 'Jenkins', detail: 'Self-hosted controller', required: false, icon: <Icon.Pipeline size={16} />, scopes: ['read', 'build history'] },
      { id: 'azure', name: 'Azure DevOps', detail: 'Pipelines and releases', required: false, icon: <Icon.Pipeline size={16} />, scopes: ['vso.build', 'vso.release'] },
    ],
  },
  {
    title: 'Cloud account',
    description: 'Optional. Lets the agent tell a production environment from a staging one, which is what bounds blast radius.',
    items: [
      { id: 'alibaba', name: 'Alibaba Cloud', detail: 'RAM role assumption and ActionTrail', required: false, icon: <Icon.Layers size={16} />, scopes: ['ram:GetRole', 'actiontrail:LookupEvents'] },
      { id: 'aws', name: 'AWS', detail: 'IAM role and CloudTrail', required: false, icon: <Icon.Layers size={16} />, scopes: ['iam:GetRole', 'cloudtrail:LookupEvents'] },
    ],
  },
];

export default function ConnectPage() {
  const [connected, setConnected] = useState<Record<string, boolean>>({ github: true, gha: true });
  const scmConnected = groups[0].items.some((i) => connected[i.id]);

  return (
    <div className="space-y-xl">
      {groups.map((group) => (
        <Panel key={group.title}>
          <PanelHeader title={group.title} description={group.description} />
          <ul className="divide-y divide-[color:var(--border-secondary)]">
            {group.items.map((item) => {
              const on = !!connected[item.id];
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-lg px-3xl py-xl">
                  <span className={cn('mt-xxs shrink-0', on ? 'text-[color:var(--fg-brand-primary)]' : 'text-quaternary')}>
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-md">
                      <span className="text-text-sm font-semibold text-primary">{item.name}</span>
                      {item.required ? (
                        <span className="rounded-full border border-secondary bg-tertiary px-md py-xxs text-text-xs text-tertiary">
                          required
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-xxs text-text-sm text-tertiary">{item.detail}</p>
                    {on ? (
                      <div className="mt-md flex flex-wrap gap-xs">
                        {item.scopes.map((s) => (
                          <span key={s} className="rounded-md border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-tertiary">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant={on ? 'secondary' : 'primary'}
                    onClick={() => setConnected({ ...connected, [item.id]: !on })}
                  >
                    {on ? <><Icon.Check size={12} /> Connected</> : 'Connect'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}

      <Panel className="border-dashed">
        <div className="flex items-start gap-lg px-3xl py-xl">
          <span className="mt-xxs shrink-0 text-quaternary"><Icon.Lock size={16} /></span>
          <p className="max-w-paragraph text-text-sm leading-relaxed text-tertiary">
            PipelineGuard asks for the narrowest scopes that let it do the job, and every scope it does not
            hold is visible in the reasoning chains. When an investigation cannot be resolved because of a
            missing scope, the agent says so and refuses, rather than guessing around the gap.
          </p>
        </div>
      </Panel>

      <div className="flex justify-between gap-md">
        <Link href="/welcome"><Button variant="ghost">Back</Button></Link>
        <Link href="/setup">
          <Button variant="primary" disabled={!scmConnected}>
            Continue <Icon.ArrowRight size={13} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
