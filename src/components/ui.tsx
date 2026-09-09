import type { ComponentProps, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  ...props
}: ComponentProps<'section'> & { children: ReactNode }) {
  return (
    <section
      className={`rounded-3xl border border-line bg-surface p-5 ${className}`}
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
  tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'onTile';
}) {
  const tones = {
    neutral: 'border-line text-muted',
    accent: 'border-transparent bg-accent-soft text-accent',
    warn: 'border-transparent bg-warn-soft text-warn',
    danger: 'border-transparent bg-danger-soft text-danger',
    // Per quando la pillola sta sopra un tile a colore pieno (teal,
    // terracotta): tile-cream/tile-ink sono fissi fra i temi, come i tile
    // stessi — text-muted o border-line ci sparirebbero sotto.
    onTile: 'border-transparent bg-tile-cream text-tile-ink',
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
  // Il pulsante primario porta il teal dei tile decorativi, non il nero su
  // crema di prima: un colore vero, non un'ombra del testo.
  const variants = {
    primary:
      'bg-tile-teal text-tile-cream hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
    ghost: 'border border-line text-foreground hover:bg-accent-soft disabled:opacity-40',
  } as const;

  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 text-base font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-3xl border border-line bg-surface">
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

/**
 * Lo stesso linguaggio dell'hero della home, in formato pagina: blocco a
 * colore pieno, titolo enorme e stretto — cosi' le pagine "utility"
 * (analizza, inventario, account) non sembrano un'altra app rispetto alla
 * home solo perche' sono dense. Teal e' il colore "si comincia qui" —
 * stesso ruolo del pulsante primario e della nav attiva.
 */
export function PageHeader({
  title,
  subtitle,
  tone = 'teal',
}: {
  title: string;
  subtitle?: string;
  tone?: 'teal' | 'terracotta';
}) {
  const toneClass = tone === 'teal' ? 'bg-tile-teal text-tile-cream' : 'bg-tile-terracotta text-tile-ink';

  return (
    <div className={`rounded-block px-6 py-8 sm:py-10 ${toneClass}`}>
      <h1 className="text-[clamp(2rem,1.6rem+2vw,3rem)] font-semibold leading-[0.95] tracking-tighter text-balance">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 max-w-md text-sm sm:text-base">{subtitle}</p> : null}
    </div>
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
