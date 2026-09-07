import React, { useState } from 'react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { useLocale, useSource, useTheme } from '@/lib/providers';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: 'star';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { href: '/overview', label: 'Security overview', icon: <Icon.Shield /> },
      { href: '/live', label: 'Live run', icon: <Icon.Activity />, badge: 'star' },
      { href: '/analyze', label: 'Analyze a repo', icon: <Icon.Radar /> },
      { href: '/reasoning', label: 'AI reasoning', icon: <Icon.Brain />, badge: 'star' },
      { href: '/fixes', label: 'Fix center', icon: <Icon.Wrench /> },
      { href: '/findings', label: 'Findings', icon: <Icon.Alert /> },
      { href: '/reviews', label: 'Review queue', icon: <Icon.Inbox /> },
      { href: '/alerts', label: 'Alerts', icon: <Icon.Bell /> },
    ],
  },
  {
    label: 'Estate',
    items: [
      { href: '/repositories', label: 'Repositories', icon: <Icon.Repo /> },
      { href: '/pipelines', label: 'Pipelines', icon: <Icon.Pipeline /> },
      { href: '/graph', label: 'Dependency graph', icon: <Icon.Graph /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/history', label: 'History & learning', icon: <Icon.History /> },
      { href: '/trends', label: 'Trends', icon: <Icon.Chart /> },
      { href: '/agent', label: 'Agent control', icon: <Icon.Radar /> },
    ],
  },
  {
    label: 'Govern',
    items: [
      { href: '/policies', label: 'Policies', icon: <Icon.Policy /> },
      { href: '/audit', label: 'Audit log', icon: <Icon.Book /> },
      { href: '/team', label: 'Team', icon: <Icon.Users /> },
      { href: '/integrations', label: 'Integrations', icon: <Icon.Plug /> },
      { href: '/settings', label: 'Settings', icon: <Icon.Settings /> },
    ],
  },
  {
    label: 'Demo',
    items: [
      { href: '/demo', label: 'Three-outcome demo', icon: <Icon.Play /> },
      { href: '/replay', label: 'Replay center', icon: <Icon.Replay /> },
    ],
  },
];

function Brand() {
  return (
    <Link href="/overview" className="flex items-center gap-lg px-xl py-xl">
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
        <Icon.ShieldCheck size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-text-sm font-semibold tracking-tight text-primary">
          PipelineGuard
        </span>
        <span className="block truncate font-mono text-text-xs text-quaternary">northwind</span>
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [pathname] = useLocation();
  return (
    <nav className="scroll-thin flex h-full flex-col overflow-y-auto">
      <Brand />
      <div className="flex-1 px-lg pb-3xl">
        {groups.map((group) => (
          <div key={group.label} className="mb-xl">
            <p className="px-lg pb-md pt-md text-text-xs font-medium uppercase tracking-wider text-quaternary">
              {group.label}
            </p>
            <ul className="space-y-xxs">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-lg rounded-md px-lg py-md text-text-sm transition-colors',
                        active
                          ? 'bg-tertiary font-medium text-primary'
                          : 'text-tertiary hover:bg-primary-hover hover:text-secondary',
                      )}
                    >
                      <span className={cn('shrink-0', active ? 'text-[color:var(--fg-brand-primary)]' : 'text-quaternary group-hover:text-tertiary')}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge === 'star' ? (
                        <span className="shrink-0 text-[color:var(--fg-brand-primary)]">
                          <Icon.Spark size={12} />
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * Source pill.
 *
 * Deliberately always visible and always honest. During a live demo this is
 * the only place replay is disclosed -- the data and pacing are identical, so
 * without this the operator could not tell either. It also surfaces live
 * failure count, which is the cue to switch before anyone notices.
 */
function SourcePill() {
  const { mode, setMode, lastLatency, liveFailures } = useSource();
  const replay = mode === 'replay';
  return (
    <button
      onClick={() => setMode(replay ? 'live' : 'replay')}
      title={replay
        ? 'Serving from the recorded cassette. Click to return to the live gateway.'
        : 'Serving from the live gateway. Click to switch to the recorded cassette.'}
      className={cn(
        'inline-flex items-center gap-md rounded-full border px-lg py-xs text-text-xs font-medium transition-colors',
        replay
          ? 'border-brand bg-brand-primary-alt text-brand-secondary'
          : 'border-secondary bg-tertiary text-tertiary hover:border-primary',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', !replay && 'pulse-ring')}
        style={{ background: replay ? 'var(--fg-brand-primary)' : 'var(--fg-success-primary)' }}
      />
      {replay ? 'Replay' : 'Live'}
      {lastLatency !== null ? (
        <span className="tnum font-mono text-quaternary">{lastLatency}ms</span>
      ) : null}
      {!replay && liveFailures > 0 ? (
        <span className="tnum rounded-full bg-error-secondary px-xs text-white">{liveFailures}</span>
      ) : null}
    </button>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { locale, setLocale } = useLocale();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-xl border-b border-secondary bg-primary px-xl backdrop-blur">
      <div className="flex items-center gap-lg">
        <button
          onClick={onMenu}
          className="rounded-md p-md text-tertiary hover:bg-primary-hover lg:hidden"
          aria-label="Open navigation"
        >
          <Icon.Layers size={18} />
        </button>
        <div className="hidden items-center gap-md rounded-md border border-secondary bg-secondary px-lg py-xs text-text-sm text-quaternary sm:flex">
          <Icon.Search size={14} />
          <span>Search repositories, findings, runs</span>
          <kbd className="ml-xl rounded border border-secondary bg-tertiary px-xs font-mono text-text-xs">/</kbd>
        </div>
      </div>

      <div className="flex items-center gap-md">
        <SourcePill />

        <div className="flex items-center rounded-md border border-secondary bg-secondary p-xxs">
          {(['en', 'ur'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={cn(
                'rounded px-md py-xxs text-text-xs font-medium transition-colors',
                locale === l ? 'bg-primary text-primary shadow-xs' : 'text-quaternary hover:text-tertiary',
              )}
              title={l === 'ur' ? 'Urdu — agent explanations translate in place' : 'English'}
            >
              {l === 'en' ? 'EN' : 'اردو'}
            </button>
          ))}
        </div>

        <button
          onClick={toggle}
          className="rounded-md border border-secondary bg-secondary p-md text-tertiary transition-colors hover:text-secondary"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Icon.Sun size={15} /> : <Icon.Moon size={15} />}
        </button>

        <div className="ml-md hidden items-center gap-md border-l border-secondary pl-xl sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-solid text-text-xs font-semibold text-white">
            SA
          </span>
          <span className="hidden text-text-sm text-secondary md:block">Sara A.</span>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    // Direction is decided per text block via dir="auto", not forced here:
    // the UI chrome is English even when agent output is Urdu.
    <div className="min-h-screen bg-secondary">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[248px] border-e border-secondary bg-primary lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg-overlay)_60%,transparent)]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-[264px] border-e border-secondary bg-primary">
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:ps-[248px]">
        <Header onMenu={() => setOpen(true)} />
        <main className="px-xl py-3xl sm:px-3xl lg:px-4xl">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
