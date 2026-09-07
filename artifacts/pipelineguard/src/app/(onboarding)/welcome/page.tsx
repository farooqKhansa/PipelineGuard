import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button, Panel, PanelHeader } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const roles = [
  { value: 'engineer', label: 'Engineer', can: 'Approves fixes on their own repositories' },
  { value: 'security', label: 'Security', can: 'Approves fixes on production pipelines' },
  { value: 'viewer', label: 'Viewer', can: 'Reads findings and reasoning, approves nothing' },
];

export default function WelcomePage() {
  const [invites, setInvites] = useState([
    { email: '', role: 'engineer' },
  ]);

  return (
    <div className="space-y-xl">
      <Panel>
        <PanelHeader
          title="Create your organisation"
          description="Everything PipelineGuard monitors belongs to one organisation. You can add more later."
        />
        <div className="space-y-xl px-3xl py-xl">
          <Field label="Organisation name" htmlFor="org">
            <Input id="org" defaultValue="Northwind" placeholder="Acme Inc" />
          </Field>
          <Field
            label="Slug"
            htmlFor="slug"
            hint="Used in URLs and in the audit log. Lowercase, no spaces."
          >
            <Input id="slug" defaultValue="northwind" placeholder="acme" />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Invite the people who will approve fixes"
          description="PipelineGuard holds high-impact fixes for a human. If nobody can approve them, they queue forever — so invite at least one reviewer now."
        />
        <div className="space-y-lg px-3xl py-xl">
          {invites.map((inv, i) => (
            <div key={i} className="flex flex-wrap items-end gap-md">
              <div className="min-w-[220px] flex-1">
                <Field label={i === 0 ? 'Email' : ''} htmlFor={`invite-${i}`}>
                  <Input
                    id={`invite-${i}`}
                    type="email"
                    placeholder="colleague@company.com"
                    value={inv.email}
                    onChange={(e) => {
                      const next = [...invites];
                      next[i] = { ...next[i], email: e.target.value };
                      setInvites(next);
                    }}
                  />
                </Field>
              </div>
              <div className="min-w-[160px]">
                <Field label={i === 0 ? 'Role' : ''} htmlFor={`role-${i}`}>
                  <select
                    id={`role-${i}`}
                    value={inv.role}
                    onChange={(e) => {
                      const next = [...invites];
                      next[i] = { ...next[i], role: e.target.value };
                      setInvites(next);
                    }}
                    className="w-full rounded-md border border-primary bg-primary px-lg py-md text-text-sm text-primary focus:border-brand focus:outline-none"
                  >
                    {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
              </div>
              {invites.length > 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => setInvites(invites.filter((_, j) => j !== i))}
                  aria-label="Remove invite"
                >
                  <Icon.X size={14} />
                </Button>
              ) : null}
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setInvites([...invites, { email: '', role: 'engineer' }])}
          >
            Add another
          </Button>

          <ul className="mt-xl space-y-md border-t border-secondary pt-xl">
            {roles.map((r) => (
              <li key={r.value} className="flex gap-lg text-text-sm">
                <span className="w-20 shrink-0 font-medium text-secondary">{r.label}</span>
                <span className="text-tertiary">{r.can}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <div className="flex justify-end gap-md">
        <Link href="/connect">
          <Button variant="primary">
            Continue <Icon.ArrowRight size={13} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
