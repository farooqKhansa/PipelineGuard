'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Bilingual, Locale, SourceMode } from '@/lib/types';

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', setTheme: () => {}, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Resolve a bilingual string for the active locale. */
  t: (b: Bilingual | undefined | null) => string;
  /** True when the active locale is right-to-left. */
  rtl: boolean;
}

const LocaleContext = createContext<LocaleCtx>({
  locale: 'en',
  setLocale: () => {},
  t: (b) => b?.en ?? '',
  rtl: false,
});
export const useLocale = () => useContext(LocaleContext);

// ---------------------------------------------------------------------------
// Source mode (live / replay)
// ---------------------------------------------------------------------------

interface SourceCtx {
  mode: SourceMode;
  setMode: (m: SourceMode) => void;
  /** Last observed gateway latency, for the status pill. */
  lastLatency: number | null;
  reportLatency: (ms: number) => void;
  /** Counts every request that failed against the live gateway. When this
   *  climbs, the operator knows to switch before a judge notices. */
  liveFailures: number;
  reportFailure: () => void;
}

const SourceContext = createContext<SourceCtx>({
  mode: 'live',
  setMode: () => {},
  lastLatency: null,
  reportLatency: () => {},
  liveFailures: 0,
  reportFailure: () => {},
});
export const useSource = () => useContext(SourceContext);

// ---------------------------------------------------------------------------

function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return (window.localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Dark is the default. This is a tool people keep open beside a terminal all
  // day, and the security-review audience expects it.
  const [theme, setThemeState] = useState<Theme>('dark');
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mode, setModeState] = useState<SourceMode>('live');
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [liveFailures, setLiveFailures] = useState(0);

  // Hydrate from storage after mount, so SSR markup and first client render
  // agree and React does not warn.
  useEffect(() => {
    setThemeState(readStored<Theme>('pg.theme', 'dark'));
    setLocaleState(readStored<Locale>('pg.locale', 'en'));
    const envReplay = process.env.NEXT_PUBLIC_REPLAY === '1';
    setModeState(envReplay ? 'replay' : readStored<SourceMode>('pg.mode', 'live'));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try { window.localStorage.setItem('pg.theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    try { window.localStorage.setItem('pg.locale', locale); } catch {}
  }, [locale]);

  useEffect(() => {
    try { window.localStorage.setItem('pg.mode', mode); } catch {}
  }, [mode]);

  // These two MUST be referentially stable. usePolling derives its fetch
  // callback from them; if they change identity, the polling effect re-runs,
  // which refetches, which updates lastLatency, which recreates them again --
  // a runaway loop that also restarts any in-flight reasoning animation.
  const reportLatency = useCallback((ms: number) => setLastLatency(ms), []);
  const reportFailure = useCallback(() => setLiveFailures((n) => n + 1), []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const setMode = useCallback((m: SourceMode) => {
    setModeState(m);
    if (m === 'live') setLiveFailures(0);
  }, []);

  const t = useCallback(
    (b: Bilingual | undefined | null) => (b ? (locale === 'ur' ? b.ur : b.en) : ''),
    [locale],
  );

  const themeValue = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  const localeValue = useMemo(() => ({ locale, setLocale, t, rtl: locale === 'ur' }), [locale, setLocale, t]);
  const sourceValue = useMemo(
    () => ({ mode, setMode, lastLatency, reportLatency, liveFailures, reportFailure }),
    [mode, setMode, lastLatency, liveFailures, reportLatency, reportFailure],
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <LocaleContext.Provider value={localeValue}>
        <SourceContext.Provider value={sourceValue}>{children}</SourceContext.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  );
}
