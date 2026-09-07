import React from 'react';
import { Link } from 'wouter';
import { usePolling } from '@/lib/api/hooks';
import { useSource } from '@/lib/providers';
import type { RecordedRun } from '@/lib/types';
import { Button, PageHeader, Panel, PanelHeader, Skeleton, Table, Td, Th, Tr } from '@/components/ui/primitives';
import { cassetteCoverage } from '@/lib/replay/cassette';
import { Icon } from '@/components/ui/icons';
import { cn, formatDuration, relativeTime } from '@/lib/utils';

export default function ReplayCenterPage() {
  const { mode, setMode, lastLatency, liveFailures } = useSource();
  const { data, initial } = usePolling<RecordedRun[]>('replay/cassettes', 0);
  const cassettes = data ?? [];
  const replay = mode === 'replay';

  return (
    <>
      <PageHeader
        title="Replay center"
        description="Fallback for the live demo. Replay is not a mock of the product — it is the recorded gateway, served through the same code path at the same speed."
        actions={
          <Button variant={replay ? 'secondary' : 'primary'} onClick={() => setMode(replay ? 'live' : 'replay')}>
            {replay ? <><Icon.Activity size={13} /> Switch to live</> : <><Icon.Replay size={13} /> Switch to replay</>}
          </Button>
        }
      />

      <div className="mb-xl grid gap-xl lg:grid-cols-[1fr_1.2fr]">
        <Panel className={cn(replay && 'border-brand')}>
          <PanelHeader title="Current source" />
          <div className="px-3xl py-xl">
            <div className="flex items-center gap-lg">
              <span
                className={cn('h-2.5 w-2.5 rounded-full', !replay && 'pulse-ring')}
                style={{ background: replay ? 'var(--fg-brand-primary)' : 'var(--fg-success-primary)' }}
              />
              <span className="text-text-lg font-semibold text-primary">
                {replay ? 'Recorded cassette' : 'Live gateway'}
              </span>
            </div>

            <dl className="mt-xl space-y-lg text-text-sm">
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Last response</dt>
                <dd className="tnum font-mono text-secondary">{lastLatency !== null ? `${lastLatency}ms` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Live failures this session</dt>
                <dd className={cn('tnum font-mono', liveFailures > 0 ? 'text-error-primary' : 'text-secondary')}>
                  {liveFailures}
                </dd>
              </div>
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Gateway version</dt>
                <dd className="font-mono text-secondary">gw-0.4.2</dd>
              </div>
              <div className="flex justify-between gap-lg">
                <dt className="text-quaternary">Paths covered offline</dt>
                <dd className="tnum font-mono text-secondary">{cassetteCoverage.length}</dd>
              </div>
            </dl>

            {liveFailures > 0 && !replay ? (
              <div className="mt-xl rounded-lg border border-error-subtle bg-error-primary px-lg py-md">
                <p className="text-text-sm font-medium text-error-primary">
                  {liveFailures} live request{liveFailures === 1 ? '' : 's'} failed.
                </p>
                <p className="mt-xxs text-text-xs leading-relaxed text-tertiary">
                  Switch to replay now, before a screen goes blank mid-demo. The audience will not see a
                  difference in data or timing.
                </p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Why replay is indistinguishable from live"
            description="Not by imitation — by construction."
          />
          <ol className="space-y-lg px-3xl py-xl">
            {[
              ['Same payloads', 'The cassette and the gateway build responses from the same source. There is no second, simplified dataset that could drift.'],
              ['Same latency', 'Latency is a pure function of the request path, identical in both. Replay does not return instantly, and it does not fake a random delay either — it returns in the same number of milliseconds the gateway would have taken.'],
              ['Same code path', 'Components call one hook. Neither the hook nor any screen branches on mode; the swap happens below them.'],
              ['Same step timing', 'Reasoning chains animate from each step’s recorded duration, so an investigation unfolds at its true pace in either mode.'],
              ['Bundled, not fetched', 'The cassette ships in the JavaScript bundle. It works with the network unplugged, which is the failure it exists to survive.'],
            ].map(([title, body], i) => (
              <li key={i} className="flex gap-lg">
                <span className="mt-xxs flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-secondary bg-tertiary font-mono text-text-xs text-tertiary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-text-sm font-medium text-primary">{title}</p>
                  <p className="mt-xxs text-text-sm leading-relaxed text-tertiary">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t border-secondary px-3xl py-lg text-text-xs leading-relaxed text-tertiary">
            The one visible difference is the header pill, which is deliberate. Hiding the mode from the
            operator would be the wrong kind of seamless.
          </p>
        </Panel>
      </div>

      <Panel className="mb-xl">
        <PanelHeader
          title="Recorded runs"
          description="Each cassette is a full clean run captured from the gateway, checksummed so it can be shown to be unmodified."
        />
        {initial ? (
          <div className="p-3xl"><Skeleton className="h-24" /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cassette</Th>
                <Th>Recorded</Th>
                <Th className="text-end">Responses</Th>
                <Th className="text-end">Duration</Th>
                <Th>Checksum</Th>
              </tr>
            </thead>
            <tbody>
              {cassettes.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <span className="font-medium text-primary">{c.name}</span>
                    <span className="mt-xxs block font-mono text-text-xs text-quaternary">{c.id}</span>
                  </Td>
                  <Td className="font-mono text-text-xs text-quaternary">{relativeTime(c.recordedAt)}</Td>
                  <Td className="tnum text-end font-mono text-text-xs">{c.responseCount}</Td>
                  <Td className="tnum text-end font-mono text-text-xs">{formatDuration(c.durationMs)}</Td>
                  <Td className="max-w-[220px] truncate font-mono text-text-xs text-quaternary" >
                    {c.checksum}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Cached response coverage"
          description="Every gateway path the cassette can answer without a network call. Anything not listed here would fall through to live."
        />
        <div className="flex flex-wrap gap-md px-3xl py-xl">
          {cassetteCoverage.map((p) => (
            <span key={p} className="rounded-md border border-secondary bg-tertiary px-md py-xxs font-mono text-text-xs text-tertiary">
              /{p.replace(/[\^$]/g, '').replace(/\\\//g, '/')}
            </span>
          ))}
        </div>
        <div className="border-t border-secondary px-3xl py-lg">
          <Link href="/demo" className="inline-flex items-center gap-xs text-text-sm font-medium text-brand-secondary hover:underline">
            Run the three-outcome demo on this source <Icon.ArrowRight size={13} />
          </Link>
        </div>
      </Panel>
    </>
  );
}
