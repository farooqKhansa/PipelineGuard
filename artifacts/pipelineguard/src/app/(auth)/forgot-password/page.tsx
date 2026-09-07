import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  if (sent) {
    return (
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-secondary bg-tertiary text-quaternary">
          <Icon.Inbox size={18} />
        </span>
        <h1 className="mt-xl text-display-xs font-semibold tracking-tight text-primary">Check your inbox</h1>
        <p className="mt-xs text-text-sm leading-relaxed text-tertiary">
          If an account exists for <span className="font-mono text-secondary">{email}</span>, a reset link is
          on its way. The link expires in 30 minutes.
        </p>
        <Link
          href="/login"
          className="mt-3xl inline-block text-text-sm font-medium text-brand-secondary hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display-xs font-semibold tracking-tight text-primary">Reset your password</h1>
      <p className="mt-xs text-text-sm text-tertiary">We will email you a link to set a new one.</p>

      <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="mt-3xl space-y-xl">
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
        <Button type="submit" variant="primary" className="w-full">Send reset link</Button>
      </form>

      <Link href="/login" className="mt-3xl inline-block text-text-sm font-medium text-brand-secondary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
