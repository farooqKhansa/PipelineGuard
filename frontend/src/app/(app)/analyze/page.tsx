'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiPost, ApiError } from '@/lib/api/client';
import {
  adaptBackendAnalysis,
  type BackendAction,
  type BackendAnalyzeResponse,
  type BackendAssessmentView,
  type BackendReason,
} from '@/lib/contract/backend-adapt';
import {
  Button, PageHeader, Panel, PanelHeader, Skeleton,
} from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';

const PHASES = [
  'Reading repository metadata',
  'Fetching workflow files',
  'Calling Detection Core',
  'Applying the authoritative agentic boundary',
  'Persisting the assessment',
];

export default function AnalyzePage() {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<BackendAssessmentView | null>(null);

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (!repo.trim() || busy) return;

    setBusy(true);
    setError(null);
    setAssessment(null);
    setPhase(0);
    const ticker = window.setInterval(
      () => setPhase((current) => Math.min(current + 1, PHASES.length - 1)),
      900,
    );

    try {
      const result = await apiPost<BackendAnalyzeResponse>('analyze', {
        repo: repo.trim(),
        // The gateway promises not to persist or echo this request-scoped
        // token. An empty token is omitted rather than sent as a credential.
        ...(token.trim() ? { token: token.trim() } : {}),
      });
      setAssessment(adaptBackendAnalysis(result.data));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The gateway could not be reached.');
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Analyze a repository"
        description="Live analysis goes through the Archive A FastAPI gateway, Detection Core contract, and authoritative agentic boundary. Missing evidence stays visible."
      />

      <Panel className="mb-xl">
        <PanelHeader
          title="Repository"
          description="Public repositories need no token. A private-repository token is used only for this request and is never stored by the gateway."
        />
        <form onSubmit={analyze} className="p-3xl">
          <div className="flex flex-wrap items-end gap-lg">
            <div className="min-w-[280px] flex-1">
              <Field label="owner / repo" htmlFor="repo">
                <Input
                  id="repo"
                  value={repo}
                  onChange={(event) => setRepo(event.target.value)}
                  placeholder="owner/repository"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </Field>
            </div>
            <div className="min-w-[240px] flex-1">
              <Field
                label="GitHub token (optional)"
                htmlFor="token"
                hint="Request-scoped; leave blank for public repositories."
              >
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                    className="pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((visible) => !visible)}
                    className="absolute inset-y-0 end-0 px-lg text-text-xs text-tertiary hover:text-secondary"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={busy || !repo.trim()}>
              <Icon.Radar size={14} />
              {busy ? 'Analyzing…' : 'Analyze repository'}
            </Button>
          </div>
        </form>
      </Panel>

      {busy ? (
        <Panel className="mb-xl">
          <PanelHeader
            title="Live gateway run"
            description="These are progress labels for the request; they are not synthetic detection evidence."
          />
          <div className="space-y-lg p-3xl">
            {PHASES.map((label, index) => (
              <div key={label} className="flex items-center gap-lg">
                <span className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-text-xs',
                  index < phase
                    ? 'border-brand bg-brand-primary-alt text-brand-secondary'
                    : index === phase
                      ? 'border-brand text-brand-secondary'
                      : 'border-secondary text-quaternary',
                ].join(' ')}>
                  {index < phase ? <Icon.Check size={12} /> : index + 1}
                </span>
                <span className={index <= phase ? 'text-text-sm text-primary' : 'text-text-sm text-quaternary'}>
                  {label}
                </span>
                {index === phase ? <span className="caret text-brand-secondary" /> : null}
              </div>
            ))}
            <Skeleton className="mt-xl h-2 w-full" />
          </div>
        </Panel>
      ) : null}

      {error ? (
        <Panel className="mb-xl border-error">
          <PanelHeader
            title="Live analysis failed"
            description="The frontend received an error from the gateway. No assessment was invented."
          />
          <div className="flex items-start gap-lg p-3xl text-text-sm text-error-primary">
            <Icon.Alert size={16} />
            <span>{error}</span>
          </div>
        </Panel>
      ) : null}

      {assessment ? <AssessmentPanel assessment={assessment} /> : null}
    </>
  );
}

function AssessmentPanel({ assessment }: { assessment: BackendAssessmentView }) {
  const { detection, agentic } = assessment;
  const detectionUnavailable = detection.status === 'unavailable';
  const detectionInvalid = detection.status === 'invalid_response';
  const complete = agentic.evidenceStatus === 'complete';

  return (
    <div className="space-y-xl">
      <Panel>
        <PanelHeader
          title="Detection result"
          description={`${assessment.repo ?? 'Repository unavailable'} · run ${assessment.runId ?? 'not returned'}`}
          actions={
            <span className="rounded-full border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-tertiary">
              {assessment.source ?? 'source unavailable'}
            </span>
          }
        />
        <div className="grid gap-xl p-3xl sm:grid-cols-3">
          <Metric label="Detection status" value={detection.status ?? 'not returned'} />
          <Metric
            label="Risk score"
            value={detection.displayRiskScore === null ? 'Not available' : `${detection.displayRiskScore} / 100`}
            detail={detection.riskScoreScale ? `source scale ${detection.riskScoreScale}` : 'scale not declared'}
          />
          <Metric label="Agentic evidence" value={agentic.evidenceStatus ?? 'not returned'} />
        </div>
      </Panel>

      {detectionUnavailable || detectionInvalid ? (
        <Panel className="border-dashed">
          <PanelHeader
            title={detectionUnavailable ? 'Detection Core unavailable' : 'Detection Core response invalid'}
            description="This is an explicit system state, not a clean or low-risk result."
          />
          <div className="space-y-lg p-3xl text-text-sm text-secondary">
            {detection.error ? <p>{detection.error}</p> : null}
            {detection.validationErrors.length > 0 ? (
              <pre className="overflow-x-auto rounded-md bg-tertiary p-lg font-mono text-text-xs text-tertiary">
                {JSON.stringify(detection.validationErrors, null, 2)}
              </pre>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-xl lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Panel>
          <PanelHeader
            title="Evidence"
            description={complete
              ? 'The gateway declared the canonical evidence complete.'
              : 'Detection may have succeeded, but absent agentic evidence remains absent.'}
          />
          <div className="space-y-xl p-3xl">
            <EvidenceList title="Available" items={detection.availableEvidence} />
            <EvidenceList title="Missing" items={detection.missingEvidence} muted />
            {detection.reasons ? (
              <div>
                <p className="mb-md text-text-xs font-medium uppercase tracking-wider text-quaternary">
                  Detection reasons
                </p>
                <ul className="space-y-md">
                  {detection.reasons.map((reason, index) => (
                    <li key={index} className="flex gap-md text-text-sm text-secondary">
                      <span className="mt-xxs text-quaternary">·</span>
                      <span>{reasonText(reason)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detection.modelBreakdown ? (
              <div>
                <p className="mb-md text-text-xs font-medium uppercase tracking-wider text-quaternary">
                  Model breakdown
                </p>
                <pre className="overflow-x-auto rounded-md bg-tertiary p-lg font-mono text-text-xs text-tertiary">
                  {JSON.stringify(detection.modelBreakdown, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </Panel>

        <DecisionPanel assessment={assessment} />
      </div>
    </div>
  );
}

function DecisionPanel({ assessment }: { assessment: BackendAssessmentView }) {
  const { agentic } = assessment;
  const action = agentic.action;
  const humanReview = agentic.humanReviewRequired === true
    || action === 'PROPOSE_WITH_CAUTION'
    || action === 'ESCALATE_TO_HUMAN'
    || action === null;

  return (
    <Panel>
      <PanelHeader
        title="Agentic decision"
        description={humanReview ? 'Human review is required.' : 'Authoritative action returned by the gateway.'}
      />
      <div className="space-y-xl p-3xl">
        <div className="flex items-start gap-lg">
          <span className="mt-xxs text-brand-secondary"><Icon.Brain size={18} /></span>
          <div>
            <p className="text-text-md font-semibold text-primary">{actionLabel(action)}</p>
            <p className="mt-xs text-text-sm leading-relaxed text-tertiary">
              {decisionCopy(action, humanReview)}
            </p>
          </div>
        </div>

        {agentic.decisionReason ? (
          <div className="rounded-md border border-secondary bg-tertiary p-lg">
            <p className="mb-xs text-text-xs font-medium uppercase tracking-wider text-quaternary">Decision reason</p>
            <p className="text-text-sm leading-relaxed text-secondary">{agentic.decisionReason}</p>
          </div>
        ) : null}
        {agentic.error ? <p className="text-text-sm text-warning-primary">{agentic.error}</p> : null}
        {agentic.warnings && agentic.warnings.length > 0 ? (
          <ul className="space-y-xs text-text-xs text-warning-primary">
            {agentic.warnings.map((warning, index) => <li key={index}>{String(warning)}</li>)}
          </ul>
        ) : null}
        {agentic.fixDiff ? (
          <div>
            <p className="mb-md text-text-xs font-medium uppercase tracking-wider text-quaternary">
              Generated diff — not applied
            </p>
            <pre className="max-h-80 overflow-auto rounded-md bg-[#0b0e14] p-lg font-mono text-text-xs leading-relaxed text-secondary">
              {agentic.fixDiff}
            </pre>
          </div>
        ) : (
          <p className="border-t border-secondary pt-lg text-text-sm text-tertiary">
            No fix was returned. The frontend does not create a diff, mark a fix applied, or create a pull request.
          </p>
        )}
        {agentic.verification ? <VerificationPanel verification={agentic.verification} /> : null}
        {agentic.prUrl ? (
          <Link href={agentic.prUrl} target="_blank" rel="noreferrer" className="text-text-sm text-brand-secondary hover:underline">
            Open returned pull request
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}

function VerificationPanel({ verification }: { verification: NonNullable<BackendAssessmentView['agentic']['verification']> }) {
  return (
    <div className="border-t border-secondary pt-lg">
      <p className="mb-md text-text-xs font-medium uppercase tracking-wider text-quaternary">Verification</p>
      {verification.status ? <p className="text-text-sm text-secondary">Status: {verification.status}</p> : null}
      {typeof verification.passed === 'boolean' ? (
        <p className="text-text-sm text-secondary">Passed: {verification.passed ? 'yes' : 'no'}</p>
      ) : null}
      {verification.method ? <p className="mt-xs text-text-sm leading-relaxed text-tertiary">{verification.method}</p> : null}
      {verification.checks && verification.checks.length > 0 ? (
        <ul className="mt-md space-y-xs">
          {verification.checks.map((check, index) => (
            <li key={index} className="flex justify-between gap-lg text-text-xs text-tertiary">
              <span>{check.name ?? 'Unnamed check'}</span>
              <span className="font-mono">{check.status ?? 'not reported'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EvidenceList({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <p className="mb-md text-text-xs font-medium uppercase tracking-wider text-quaternary">{title}</p>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-sm">
          {items.map((item) => (
            <li key={item} className={[
              'rounded-md border px-md py-xxs font-mono text-text-xs',
              muted ? 'border-dashed border-secondary text-quaternary' : 'border-secondary bg-tertiary text-tertiary',
            ].join(' ')}>
              {item}
            </li>
          ))}
        </ul>
      ) : <p className="text-text-sm text-quaternary">None reported</p>}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-text-xs font-medium uppercase tracking-wider text-quaternary">{label}</p>
      <p className="mt-md text-text-md font-semibold text-primary">{value}</p>
      {detail ? <p className="mt-xs font-mono text-text-xs text-quaternary">{detail}</p> : null}
    </div>
  );
}

function reasonText(reason: BackendReason | string): string {
  if (typeof reason === 'string') return reason;
  return reason.message ?? reason.reason ?? reason.code ?? 'Reason supplied without text';
}

function actionLabel(action: BackendAction | null): string {
  if (action === 'AUTO_FIX') return 'AUTO_FIX';
  if (action === 'PROPOSE_WITH_CAUTION') return 'PROPOSE_WITH_CAUTION';
  if (action === 'ESCALATE_TO_HUMAN') return 'ESCALATE_TO_HUMAN';
  return 'Decision unavailable';
}

function decisionCopy(action: BackendAction | null, humanReview: boolean): string {
  if (action === 'AUTO_FIX') return 'The authoritative layer permitted an automatic-fix path. Any returned diff remains proposed; this flow does not apply GitHub changes.';
  if (action === 'PROPOSE_WITH_CAUTION') return 'The authoritative layer returned a cautious proposal. A human must review it before any action.';
  if (action === 'ESCALATE_TO_HUMAN') return 'The authoritative layer escalated rather than guessing. No fix or verification is implied.';
  return humanReview
    ? 'The gateway did not return a usable action. Treat this as a human-review state, not as approval.'
    : 'No authoritative action was returned.';
}