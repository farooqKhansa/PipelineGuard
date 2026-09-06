'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';

export default function VerifyEmailPage() {
  return (
    <div>
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brand bg-brand-primary-alt text-[color:var(--fg-brand-primary)]">
        <Icon.Inbox size={18} />
      </span>
      <h1 className="mt-xl text-display-xs font-semibold tracking-tight text-primary">Verify your email</h1>
      <p className="mt-xs text-text-sm leading-relaxed text-tertiary">
        We sent a six-digit code to your work address. Enter it to activate your organisation.
      </p>

      <div className="mt-3xl flex gap-md">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            inputMode="numeric"
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            className="tnum h-12 w-full rounded-md border border-primary bg-primary text-center font-mono text-text-lg text-primary focus:border-brand focus:outline-none"
          />
        ))}
      </div>

      <Link href="/welcome" className="mt-3xl block">
        <Button variant="primary" className="w-full">Verify and continue</Button>
      </Link>

      <p className="mt-xl text-text-sm text-tertiary">
        Did not receive it?{' '}
        <button className="font-medium text-brand-secondary hover:underline">Resend code</button>
      </p>
    </div>
  );
}
