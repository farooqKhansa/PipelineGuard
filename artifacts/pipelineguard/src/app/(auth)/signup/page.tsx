import React, { useState } from 'react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/primitives';
import { Divider, Field, Input, ProviderButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => setLocation('/verify-email'), 500);
  }

  return (
    <div>
      <h1 className="text-display-xs font-semibold tracking-tight text-primary">Create an account</h1>
      <p className="mt-xs text-text-sm leading-relaxed text-tertiary">
        Connect a repository and PipelineGuard starts in observe-only mode. It takes no action until you
        allow it to.
      </p>

      <div className="mt-3xl space-y-md">
        <ProviderButton onClick={() => setLocation('/welcome')}>
          <Icon.Repo size={15} />
          Sign up with GitHub
        </ProviderButton>
      </div>

      <div className="my-xl"><Divider label="or" /></div>

      <form onSubmit={submit} className="space-y-xl">
        <Field label="Full name" htmlFor="name">
          <Input id="name" required placeholder="Sara Amin" />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" type="email" required placeholder="you@company.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 12 characters. A passphrase is fine.">
          <Input id="password" type="password" required minLength={12} placeholder="Create a password" />
        </Field>

        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-3xl text-text-sm text-tertiary">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-secondary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
