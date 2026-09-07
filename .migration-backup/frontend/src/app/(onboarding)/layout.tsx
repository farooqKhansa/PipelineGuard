'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const steps = [
  { href: '/welcome', label: 'Organisation', hint: 'Name it and invite the people who will approve fixes' },
  { href: '/connect', label: 'Connect', hint: 'Source control, CI provider, cloud account' },
  { href: '/setup', label: 'Set the rules', hint: 'Decide what the agent may do on its own' },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeIndex = Math.max(0, steps.findIndex((s) => pathname.startsWith(s.href)));

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-secondary bg-primary">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-xl px-xl py-lg">
          <Link href="/overview" className="flex items-center gap-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
              <Icon.ShieldCheck size={18} />
            </span>
            <span className="text-text-sm font-semibold tracking-tight text-primary">PipelineGuard</span>
          </Link>
          <Link href="/overview" className="text-text-sm text-quaternary hover:text-tertiary">
            Skip setup
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-xl py-4xl">
        <ol className="mb-4xl grid gap-md sm:grid-cols-3">
          {steps.map((s, i) => {
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'upcoming';
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className={cn(
                    'block rounded-lg border px-xl py-lg transition-colors',
                    state === 'active' && 'border-brand bg-brand-primary-alt',
                    state === 'done' && 'border-secondary bg-primary',
                    state === 'upcoming' && 'border-secondary bg-primary opacity-60',
                  )}
                >
                  <div className="flex items-center gap-md">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border font-mono text-text-xs',
                        state === 'done'
                          ? 'border-transparent bg-success-solid text-white'
                          : state === 'active'
                            ? 'border-brand text-brand-secondary'
                            : 'border-secondary text-quaternary',
                      )}
                    >
                      {state === 'done' ? <Icon.Check size={11} /> : i + 1}
                    </span>
                    <span className={cn('text-text-sm font-medium', state === 'upcoming' ? 'text-tertiary' : 'text-primary')}>
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-xs text-text-xs leading-relaxed text-tertiary">{s.hint}</p>
                </Link>
              </li>
            );
          })}
        </ol>

        {children}
      </div>
    </div>
  );
}
