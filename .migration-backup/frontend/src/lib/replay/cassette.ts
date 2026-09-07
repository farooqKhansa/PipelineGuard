import type { ApiResult } from '@/lib/api/client';
import {
  agentActivity, agentStats, alerts, allInvestigations, auditLog, findings,
  fixes, graphs, integrations, pipelines, policies, recordedRuns, repositories,
  reviews, runs, team, trends,
} from '@/lib/mock/data';
import { incidents, patterns } from '@/lib/mock/patterns';
import { contractRunById, contractRuns } from '@/lib/mock/contract-runs';

/**
 * Replay cassette.
 *
 * The brief asked for replay that is indistinguishable from live. The way to
 * get that is not to imitate live -- it is to make replay and live derive from
 * the same two things:
 *
 *   1. the same payload builders (below, mirroring the gateway route table)
 *   2. the same deterministic latency function (identical to the gateway's)
 *
 * Because latency is a pure function of the path rather than a random number,
 * a replayed screen settles on exactly the same frame timing as a live one.
 * There is no tell: no "REPLAY" watermark baked into responses, no rounded
 * timings, no instant loads. The only place the mode is visible is the status
 * pill in the header, which the operator controls.
 *
 * The cassette ships in the bundle, so replay works with the network fully
 * unplugged -- which is the failure it exists to survive.
 */

/** Byte-identical to latencyFor() in the gateway route handler. */
function latencyFor(path: string): number {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) | 0;
  return 90 + (Math.abs(h) % 170);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const overview = () => ({
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
});

const table: Array<{ match: RegExp; resolve: (s: string[]) => unknown }> = [
  { match: /^overview$/, resolve: overview },
  { match: /^investigations$/, resolve: () => allInvestigations },
  { match: /^investigations\/[^/]+$/, resolve: (s) => allInvestigations.find((i) => i.id === s[1]) ?? null },
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
  { match: /^feed$/, resolve: () => ({ runs: contractRuns, gateway_version: 'gw-0.4.2' }) },
  { match: /^feed\/[^/]+$/, resolve: (s) => contractRunById(s[1]) },
  { match: /^patterns$/, resolve: () => patterns },
  { match: /^incidents$/, resolve: () => incidents },
  { match: /^replay\/cassettes$/, resolve: () => recordedRuns },
];

export async function replayFetch<T>(path: string): Promise<ApiResult<T>> {
  const segments = path.split('/');
  const entry = table.find((t) => t.match.test(path));

  // Honour the recorded latency before resolving, exactly as the gateway does.
  await sleep(latencyFor(path));

  if (!entry) {
    throw new Error(`Cassette has no recording for /${path}`);
  }
  const data = entry.resolve(segments);
  if (data === null || data === undefined) {
    throw new Error(`Cassette recorded a 404 for /${path}`);
  }

  return {
    data: data as T,
    source: 'replay',
    latencyMs: latencyFor(path),
    gateway: 'gw-0.4.2',
    at: Date.now(),
  };
}

/** Path coverage, shown on the Replay Center screen so an operator can verify
 *  before a demo that nothing will fall through to the network. */
export const cassetteCoverage = table.map((t) => t.match.source);
