'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/primitives';
import { Divider, Field, Input, ProviderButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('saraamingul143@gmail.com');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // No auth backend yet. Supabase slots in here without changing this form.
    setTimeout(() => router.push('/overview'), 500);
  }

  return (
    <div>
      <h1 className="text-display-xs font-semibold tracking-tight text-primary">Sign in</h1>
      <p className="mt-xs text-text-sm text-tertiary">Continue to your organisation dashboard.</p>

      <div className="mt-3xl space-y-md">
        <ProviderButton onClick={() => router.push('/overview')}>
          <Icon.Repo size={15} />
          Continue with GitHub
        </ProviderButton>
        <ProviderButton onClick={() => router.push('/overview')}>
          <Icon.Branch size={15} />
          Continue with GitLab
        </ProviderButton>
      </div>

      <div className="my-xl"><Divider label="or" /></div>

      <form onSubmit={submit} className="space-y-xl">
        <Field label="Work email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-md text-text-sm text-tertiary">
            <input type="checkbox" className="accent-[color:var(--fg-brand-primary)]" />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-text-sm font-medium text-brand-secondary hover:underline">
            Forgot password
          </Link>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-3xl text-text-sm text-tertiary">
        No account yet?{' '}
        <Link href="/signup" className="font-medium text-brand-secondary hover:underline">Create one</Link>
      </p>
    </div>
  );
}
