'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

/**
 * Auth shell.
 *
 * Two panes: the form, and a quiet statement of what the product does. The
 * right pane deliberately shows the product thesis rather than stock imagery —
 * anyone landing here should be able to tell what PipelineGuard is before
 * signing in.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-primary lg:grid-cols-2">
      <div className="flex flex-col px-xl py-3xl sm:px-4xl">
        <Link href="/overview" className="flex items-center gap-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
            <Icon.ShieldCheck size={18} />
          </span>
          <span className="text-text-sm font-semibold tracking-tight text-primary">PipelineGuard</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-6xl">
          <div className="w-full max-w-xs">{children}</div>
        </div>

        <p className="text-text-xs text-quaternary">
          Alibaba Cloud AI Hackathon Pakistan 2026
        </p>
      </div>

      <aside className="hidden border-s border-secondary bg-secondary px-4xl py-6xl lg:flex lg:flex-col lg:justify-center">
        <div className="max-w-md">
          <p className="font-mono text-text-xs uppercase tracking-wider text-brand-secondary">
            The blind spot
          </p>
          <h2 className="mt-lg text-display-xs font-semibold leading-snug tracking-tight text-primary">
            Your scanner checks the code. Nobody checks the assembly line that ships it.
          </h2>
          <p className="mt-xl text-text-md leading-relaxed text-tertiary">
            A junior engineer widens a permission to unblock a failing deploy. No test fails. No scanner
            complains. Six weeks later that scope is how an incident happens.
          </p>

          <ul className="mt-4xl space-y-xl">
            {[
              ['Learns from history', 'Reads past runs, config diffs and outcomes, and generalises patterns it can cite by id.'],
              ['Understands connections', 'Reasons over the job graph, so it sees the permission two hops away from the risky step.'],
              ['Fixes, or says why not', 'Writes the patch, validates it, and refuses when the evidence does not settle the question.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-lg">
                <span className="mt-xxs shrink-0 text-[color:var(--fg-brand-primary)]">
                  <Icon.Check size={15} />
                </span>
                <div>
                  <p className="text-text-sm font-medium text-primary">{title}</p>
                  <p className="mt-xxs text-text-sm leading-relaxed text-tertiary">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
