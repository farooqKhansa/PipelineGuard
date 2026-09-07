import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useLocale } from '@/lib/providers';
import type { Finding, Severity } from '@/lib/types';
import {
  EmptyState, PageHeader, Panel, SeverityBadge, Skeleton, StatusBadge, Table, Td, Th, Tr,
} from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn, relativeTime, severityRank } from '@/lib/utils';

const severities: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];

const categoryLabels: Record<Finding['category'], string> = {
  permissions: 'Permissions',
  secrets: 'Secrets',
  supply_chain: 'Supply chain',
  integrity: 'Integrity',
  policy: 'Policy',
  exposure: 'Exposure',
};

export default function FindingsPage() {
  const { t } = useLocale();
  const [sev, setSev] = useState<Severity | 'all'>('all');
  const [query, setQuery] = useState('');
  const { data, initial } = usePolling<Finding[]>('findings', 20_000);

  const list = useMemo(() => {
    const all = data ?? [];
    return all
      .filter((f) => sev === 'all' || f.severity === sev)
      .filter((f) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          f.id.toLowerCase().includes(q) ||
          f.title.en.toLowerCase().includes(q) ||
          f.repo.toLowerCase().includes(q) ||
          f.ruleId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  }, [data, sev, query]);

  return (
    <>
      <PageHeader
        title="Findings"
        description="Configuration weaknesses in the pipeline itself — permissions, secrets, supply chain and integrity — not vulnerabilities in the application code."
      />

      <div className="mb-xl flex flex-wrap items-center gap-md">
        {severities.map((s) => {
          const count = s === 'all'
            ? (data ?? []).length
            : (data ?? []).filter((f) => f.severity === s).length;
          return (
            <button
              key={s}
              onClick={() => setSev(s)}
              className={cn(
                'inline-flex items-center gap-md rounded-md border px-lg py-md text-text-sm font-medium capitalize transition-colors',
                sev === s ? 'border-primary bg-tertiary text-primary' : 'border-secondary bg-primary text-tertiary hover:border-primary',
              )}
            >
              {s}
              <span className="tnum font-mono text-text-xs text-quaternary">{count}</span>
            </button>
          );
        })}

        <label className="ms-auto flex items-center gap-md rounded-md border border-secondary bg-primary px-lg py-md">
          <Icon.Search size={14} className="text-quaternary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by id, rule, repository"
            className="w-56 bg-transparent text-text-sm text-primary outline-none placeholder:text-placeholder"
          />
        </label>
      </div>

      <Panel>
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-64" /></div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No findings match"
            description="Try clearing the severity filter or the search box."
            icon={<Icon.Search size={18} />}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Finding</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Category</Th>
                <Th>Location</Th>
                <Th className="text-end">Detected</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <Tr key={f.id}>
                  <Td className="font-mono text-text-xs text-quaternary">
                    <Link href={`/findings/${f.id}`} className="hover:text-secondary">{f.id}</Link>
                  </Td>
                  <Td className="max-w-[340px]">
                    <Link href={`/findings/${f.id}`} className="block truncate font-medium text-primary hover:underline">
                      {t(f.title)}
                    </Link>
                    <span className="mt-xxs block font-mono text-text-xs text-quaternary">{f.ruleId}</span>
                  </Td>
                  <Td><SeverityBadge severity={f.severity} /></Td>
                  <Td><StatusBadge status={f.status} /></Td>
                  <Td className="text-text-xs text-tertiary">{categoryLabels[f.category]}</Td>
                  <Td className="max-w-[220px]">
                    <span className="block truncate font-mono text-text-xs text-tertiary">
                      {f.filePath}:{f.line}
                    </span>
                    <span className="block truncate font-mono text-text-xs text-quaternary">{f.repo}</span>
                  </Td>
                  <Td className="text-end font-mono text-text-xs text-quaternary">{relativeTime(f.detectedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
