import type { ComponentProps, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  ...props
}: ComponentProps<'section'> & { children: ReactNode }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warn' | 'danger';
}) {
  const tones = {
    neutral: 'border-line text-muted',
    accent: 'border-transparent bg-accent-soft text-accent',
    warn: 'border-transparent bg-warn-soft text-warn',
    danger: 'border-transparent bg-danger-soft text-danger',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'ghost' }) {
  const variants = {
    primary:
      'bg-foreground text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
    ghost: 'border border-line text-foreground hover:bg-accent-soft disabled:opacity-40',
  } as const;

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium marker:hidden">
        <span className="flex items-center justify-between gap-3">
          {summary}
          <span className="text-muted transition group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4 text-sm">{children}</div>
    </details>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}
