import { NextRequest, NextResponse } from 'next/server';
import {
  agentActivity, agentStats, alerts, allInvestigations, auditLog, findings,
  fixes, graphs, integrations, investigationById, pipelines, policies,
  recordedRuns, repositories, reviews, runs, team, trends,
} from '@/lib/mock/data';
import { incidents, patterns } from '@/lib/mock/patterns';
import { contractRunById, contractRuns } from '@/lib/mock/contract-runs';

export const dynamic = 'force-dynamic';

/**
 * Explicit mock gateway for the showcase/replay path.
 *
 * Live analysis does not use this route. Set NEXT_PUBLIC_API_BASE to the
 * FastAPI gateway so browser requests bypass this fixture route.
 *
 * Latency is simulated *deterministically* per path. That matters: the replay
 * cassette records the same numbers, so a replayed demo has identical pacing to
 * a live one. If latency were random, the difference would be visible.
 */

function latencyFor(path: string): number {
  // Stable hash of the path -> 90..260ms. Deterministic, so replay matches.
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) | 0;
  return 90 + (Math.abs(h) % 170);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Resolver = (segments: string[], req: NextRequest) => unknown;

const routes: Array<{ match: RegExp; resolve: Resolver }> = [
  {
    match: /^overview$/,
    resolve: () => ({
      stats: agentStats,
      openFindings: findings.filter((f) => f.status === 'open' || f.status === 'in_review').length,
      criticalFindings: findings.filter((f) => f.severity === 'critical' && f.status !== 'fixed').length,
      monitoredRepos: repositories.filter((r) => r.monitored).length,
      monitoredPipelines: pipelines.length,
      pendingReviews: reviews.filter((r) => r.status === 'pending').length,
      unreadAlerts: alerts.filter((a) => !a.read).length,
      meanRisk: Math.round(trends[trends.length - 1].riskScore),
      riskDelta: Math.round(trends[trends.length - 1].riskScore - trends[0].riskScore),
      recentRuns: runs.slice(0, 6),
      recentActivity: agentActivity.slice(0, 5),
      recentFindings: findings.slice(0, 5),
      trends,
    }),
  },
  { match: /^investigations$/, resolve: () => allInvestigations },
  { match: /^investigations\/[^/]+$/, resolve: (s) => investigationById(s[1]) },
  { match: /^findings$/, resolve: () => findings },
  { match: /^findings\/[^/]+$/, resolve: (s) => findings.find((f) => f.id === s[1]) ?? null },
  { match: /^fixes$/, resolve: () => fixes },
  { match: /^fixes\/[^/]+$/, resolve: (s) => fixes.find((f) => f.id === s[1]) ?? null },
  { match: /^repositories$/, resolve: () => repositories },
  { match: /^repositories\/[^/]+$/, resolve: (s) => repositories.find((r) => r.id === s[1]) ?? null },
  { match: /^pipelines$/, resolve: () => pipelines },
  { match: /^pipelines\/[^/]+$/, resolve: (s) => pipelines.find((p) => p.id === s[1]) ?? null },
  { match: /^pipelines\/[^/]+\/graph$/, resolve: (s) => graphs[s[1]] ?? null },
  { match: /^pipelines\/[^/]+\/runs$/, resolve: (s) => runs.filter((r) => r.pipelineId === s[1]) },
  { match: /^runs$/, resolve: () => runs },
  { match: /^runs\/[^/]+$/, resolve: (s) => runs.find((r) => r.id === s[1]) ?? null },
  { match: /^trends$/, resolve: () => trends },
  { match: /^graphs\/[^/]+$/, resolve: (s) => graphs[s[1]] ?? null },
  { match: /^alerts$/, resolve: () => alerts },
  { match: /^reviews$/, resolve: () => reviews },
  { match: /^audit$/, resolve: () => auditLog },
  { match: /^policies$/, resolve: () => policies },
  { match: /^policies\/[^/]+$/, resolve: (s) => policies.find((p) => p.id === s[1]) ?? null },
  { match: /^team$/, resolve: () => team },
  { match: /^integrations$/, resolve: () => integrations },
  { match: /^agent$/, resolve: () => ({ stats: agentStats, activity: agentActivity }) },
  // Contract-shaped feed: what the FastAPI gateway is expected to return.
  { match: /^feed$/, resolve: () => ({ runs: contractRuns, gateway_version: 'gw-0.4.2' }) },
  { match: /^feed\/[^/]+$/, resolve: (s) => contractRunById(s[1]) },
  { match: /^patterns$/, resolve: () => patterns },
  { match: /^incidents$/, resolve: () => incidents },
  { match: /^replay\/cassettes$/, resolve: () => recordedRuns },
];

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  const segments = ctx.params.path ?? [];
  const key = segments.join('/');

  const route = routes.find((r) => r.match.test(key));
  if (!route) {
    return NextResponse.json(
      { error: 'not_found', path: key, hint: 'See src/app/api/v1/[...path]/route.ts for the route table.' },
      { status: 404 },
    );
  }

  const latency = latencyFor(key);
  await sleep(latency);

  const data = route.resolve(segments, req);
  if (data === null || data === undefined) {
    return NextResponse.json({ error: 'not_found', path: key }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: {
      // Surfaced in the UI status pill so the demo can prove which source
      // answered, and how long it took.
      'x-pg-source': 'mock',
      'x-pg-latency-ms': String(latency),
      'x-pg-gateway': 'gw-0.4.2',
      'cache-control': 'no-store',
    },
  });
}
