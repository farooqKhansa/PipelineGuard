'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { usePolling } from '@/lib/api/hooks';
import type { Pipeline } from '@/lib/types';
import { PageHeader, Skeleton } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const tabs = [
  { seg: '', label: 'Overview' },
  { seg: 'config', label: 'Configuration' },
  { seg: 'graph', label: 'Dependency graph' },
  { seg: 'runs', label: 'Run history' },
  { seg: 'permissions', label: 'Permissions' },
  { seg: 'secrets', label: 'Secrets & access' },
];

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: pipeline, initial } = usePolling<Pipeline>(`pipelines/${params.id}`, 0);

  const base = `/pipelines/${params.id}`;

  if (initial) {
    return <Skeleton className="h-10 w-2/3" />;
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-xs">
            <Link href="/pipelines" className="hover:text-tertiary">Pipelines</Link>
            <Icon.ChevronRight size={11} />
            <span className="font-mono">{pipeline?.repo}</span>
          </span>
        }
        title={pipeline?.name ?? 'Pipeline'}
        description={pipeline?.filePath}
        actions={
          pipeline?.touchesProduction ? (
            <span className="inline-flex items-center gap-md rounded-full border border-error bg-error-primary px-lg py-xs text-text-xs font-medium text-error-primary">
              <Icon.Lock size={12} />
              Production-bound — autonomous permission changes blocked
            </span>
          ) : null
        }
      />

      <nav className="mb-3xl border-b border-secondary">
        <ul className="scroll-thin -mb-px flex gap-xl overflow-x-auto">
          {tabs.map((tab) => {
            const href = tab.seg ? `${base}/${tab.seg}` : base;
            const active = tab.seg
              ? pathname.startsWith(href)
              : pathname === base;
            return (
              <li key={tab.seg}>
                <Link
                  href={href}
                  className={cn(
                    'block whitespace-nowrap border-b-2 px-xxs pb-lg text-text-sm font-medium transition-colors',
                    active
                      ? 'border-[color:var(--fg-brand-primary)] text-brand-secondary'
                      : 'border-transparent text-tertiary hover:text-secondary',
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </>
  );
}
