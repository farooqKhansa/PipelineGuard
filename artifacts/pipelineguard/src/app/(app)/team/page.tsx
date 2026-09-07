import React from 'react';
import { usePolling } from '@/lib/api/hooks';
import type { TeamMember } from '@/lib/types';
import {
  Button, PageHeader, Panel, PanelHeader, Skeleton, StatTile, Table, Td, Th, Tr,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime } from '@/lib/utils';

const roleMeta: Record<TeamMember['role'], { label: string; can: string }> = {
  owner: { label: 'Owner', can: 'Everything, including billing and agent scope' },
  admin: { label: 'Admin', can: 'Manage policies, integrations and members' },
  security: { label: 'Security', can: 'Approve fixes on production pipelines' },
  engineer: { label: 'Engineer', can: 'Approve fixes on their own repositories' },
  viewer: { label: 'Viewer', can: 'Read findings and reasoning, approve nothing' },
};

export default function TeamPage() {
  const { data, initial } = usePolling<TeamMember[]>('team', 30_000);
  const team = data ?? [];

  const active = team.filter((m) => m.status === 'active').length;
  const invited = team.filter((m) => m.status === 'invited').length;
  const reviewers = team.filter((m) => m.role === 'security' || m.role === 'owner' || m.role === 'admin').length;

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can approve what the agent proposes. Approval rights are the real control surface — the agent can only act where someone allowed it to."
        actions={<Button variant="primary"><Icon.Users size={13} /> Invite member</Button>}
      />

      <div className="mb-xl grid gap-xl sm:grid-cols-3">
        <StatTile label="Active members" value={active} icon={<Icon.Users size={15} />} />
        <StatTile label="Pending invitations" value={invited} icon={<Icon.Inbox size={15} />} />
        <StatTile label="Can approve production fixes" value={reviewers} sub="Required for PG-DEP-002 items" icon={<Icon.ShieldCheck size={15} />} />
      </div>

      <Panel className="mb-xl">
        <PanelHeader title="Members" />
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-48" /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th className="text-end">Reviews completed</Th>
                <Th className="text-end">Last active</Th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    <div className="flex items-center gap-lg">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-solid text-text-xs font-semibold text-white">
                        {m.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-primary">{m.name}</span>
                        <span className="block truncate font-mono text-text-xs text-quaternary">{m.email}</span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="block text-text-sm text-secondary">{roleMeta[m.role].label}</span>
                    <span className="mt-xxs block text-text-xs text-quaternary">{roleMeta[m.role].can}</span>
                  </Td>
                  <Td>
                    <span className={cn(
                      'rounded-full border px-md py-xxs text-text-xs font-medium capitalize',
                      m.status === 'active' && 'border-[color-mix(in_srgb,var(--fg-success-primary)_30%,transparent)] bg-success-primary text-success-primary',
                      m.status === 'invited' && 'border-[color-mix(in_srgb,var(--sev-medium)_35%,transparent)] bg-warning-primary text-warning-primary',
                      m.status === 'suspended' && 'border-secondary bg-tertiary text-tertiary',
                    )}>
                      {m.status}
                    </span>
                  </Td>
                  <Td className="tnum text-end font-mono text-text-xs">{m.reviewsCompleted}</Td>
                  <Td className="text-end font-mono text-text-xs text-quaternary">
                    {m.lastActive === '—' ? '—' : relativeTime(m.lastActive)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Roles and what they authorise" />
        <ul className="divide-y divide-[color:var(--border-secondary)]">
          {(Object.keys(roleMeta) as TeamMember['role'][]).map((role) => (
            <li key={role} className="flex flex-wrap items-baseline gap-lg px-3xl py-lg">
              <span className="w-24 shrink-0 text-text-sm font-medium text-primary">{roleMeta[role].label}</span>
              <span className="text-text-sm text-tertiary">{roleMeta[role].can}</span>
              <span className="tnum ms-auto font-mono text-text-xs text-quaternary">
                {team.filter((m) => m.role === role).length} member{team.filter((m) => m.role === role).length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
