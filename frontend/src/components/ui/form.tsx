'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function Field({
  label, hint, error, children, htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-text-sm font-medium text-secondary">
        {label}
      </label>
      <div className="mt-sm">{children}</div>
      {error ? (
        <p className="mt-xs text-text-xs text-error-primary">{error}</p>
      ) : hint ? (
        <p className="mt-xs text-text-xs text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={cn(
          'w-full rounded-md border border-primary bg-primary px-lg py-md text-text-sm text-primary transition-colors',
          'placeholder:text-placeholder focus:border-brand focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled',
          className,
        )}
      />
    );
  },
);

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-lg">
      <span className="h-px flex-1 bg-[color:var(--border-secondary)]" />
      <span className="text-text-xs text-quaternary">{label}</span>
      <span className="h-px flex-1 bg-[color:var(--border-secondary)]" />
    </div>
  );
}

export function ProviderButton({
  children, onClick,
}: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-md rounded-md border border-primary bg-primary px-xl py-md text-text-sm font-medium text-secondary transition-colors hover:bg-primary-hover"
    >
      {children}
    </button>
  );
}
