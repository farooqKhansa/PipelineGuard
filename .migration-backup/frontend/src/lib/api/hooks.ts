'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './client';
import { useSource } from '@/lib/providers';

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** True only on the very first load. Subsequent polls keep the old data on
   *  screen, so a dashboard never flashes a skeleton while it is being watched. */
  initial: boolean;
  latencyMs: number | null;
  updatedAt: number | null;
}

/**
 * Poll a gateway resource.
 *
 * Polling rather than websockets is deliberate for the hackathon build: it
 * degrades cleanly, it works against a FastAPI gateway with no extra
 * infrastructure, and a dropped response is invisible because the last good
 * value stays rendered.
 *
 * @param path      gateway path, without leading slash, e.g. "investigations"
 * @param intervalMs polling period. Pass 0 to fetch once.
 */
export function usePolling<T>(path: string | null, intervalMs = 0): State<T> & { refetch: () => void } {
  const { mode, reportLatency, reportFailure } = useSource();
  const [state, setState] = useState<State<T>>({
    data: null, error: null, loading: true, initial: true, latencyMs: null, updatedAt: null,
  });

  // Kept in a ref so the interval closure never goes stale without resubscribing.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const res = await apiGet<T>(path, modeRef.current);
      if (!mounted.current) return;
      reportLatency(res.latencyMs);
      setState({
        data: res.data, error: null, loading: false, initial: false,
        latencyMs: res.latencyMs, updatedAt: res.at,
      });
    } catch (e) {
      if (!mounted.current) return;
      if (modeRef.current === 'live') reportFailure();
      setState((s) => ({
        ...s,
        // Keep the previous data visible. A transient gateway blip should not
        // blank a screen someone is presenting.
        error: e instanceof Error ? e.message : 'Request failed',
        loading: false,
        initial: s.data === null,
      }));
    }
  }, [path, reportLatency, reportFailure]);

  // Held in a ref so the effect below can call the latest loader without
  // listing it as a dependency. Depending on the callback identity is what
  // turns a context update into a refetch, and a refetch back into a context
  // update -- an unbounded loop that also restarts any running animation.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    mounted.current = true;
    setState((s) => ({ ...s, loading: true }));
    void loadRef.current();
    if (intervalMs > 0) {
      const id = setInterval(() => void loadRef.current(), intervalMs);
      return () => {
        mounted.current = false;
        clearInterval(id);
      };
    }
    return () => {
      mounted.current = false;
    };
    // Keyed on the resource itself. `mode` is included so switching
    // live<->replay refetches immediately.
  }, [path, intervalMs, mode]);

  return { ...state, refetch: load };
}
