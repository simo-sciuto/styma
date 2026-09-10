import type { ComponentProps, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  ...props
}: ComponentProps<'section'> & { children: ReactNode }) {
  return (
    <section
      className={`rounded-block border border-line bg-surface p-5 sm:p-6 ${className}`}
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
  pending = false,
  disabled = false,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'ghost'; pending?: boolean }) {
  // Il pulsante primario porta il teal dei tile decorativi, non il nero su
  // crema di prima: un colore vero, non un'ombra del testo.
  const variants = {
    primary:
      'bg-tile-teal text-tile-cream hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
    ghost: 'border border-line text-foreground hover:bg-accent-soft disabled:opacity-40',
  } as const;

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-medium transition ${variants[variant]} ${className}`}
      aria-busy={pending || undefined}
      // Mentre lavora non si puo' ripremere: due salvataggi dello stesso
      // esito sono un modo silenzioso di scrivere due volte.
      disabled={pending || disabled}
      {...props}
    >
      {/*
        Il punto che pulsa mentre il bottone lavora, con l'etichetta che resta
        quella dell'azione. L'animazione parte con 120 ms di ritardo: un'azione
        che dura un battito non produce un lampo.

        `invisible` e non `hidden`, e non e' un dettaglio: sono due utility di
        display nella stessa cascata, e fra `inline-block` e `hidden` vince
        quella che nel CSS generato viene dopo — non quella scritta per ultima
        qui. Col primo tentativo il punto restava acceso su ogni bottone, anche
        fermo, e se n'e' accorta una schermata, non il compilatore. Con la
        visibilita' il conflitto non esiste, e in piu' lo spazio resta
        occupato: un punto che compare non deve spostare l'etichetta sotto il
        dito.
      */}
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
          pending ? 'pending-dot visible' : 'invisible'
        }`}
      />
      {children}
    </button>
  );
}

/**
 * L'azione secondaria: un testo sottolineato, non un bottone pieno.
 *
 * Esiste per dare anche a queste lo stesso punto in attesa dei bottoni
 * veri. Prima ognuna si arrangiava cambiando la parola — «Archivio…»,
 * «Annullo…», «Rimetto…» — cioe' tre invenzioni diverse per lo stesso
 * momento, e il testo che cambia sotto il dito sposta quello che viene dopo.
 */
export function TextButton({
  className = '',
  pending = false,
  disabled = false,
  children,
  ...props
}: ComponentProps<'button'> & { pending?: boolean }) {
  return (
    <button
      type="button"
      aria-busy={pending || undefined}
      disabled={pending || disabled}
      className={`inline-flex items-center gap-1.5 text-sm text-muted underline decoration-line underline-offset-4 disabled:opacity-60 ${className}`}
      {...props}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
          pending ? 'pending-dot visible' : 'invisible'
        }`}
      />
      {children}
    </button>
  );
}

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-block border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium marker:hidden sm:px-6">
        <span className="flex items-center justify-between gap-3">
          {summary}
          <span className="text-muted transition group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4 text-sm sm:px-6">{children}</div>
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
    <div className={`rounded-block px-5 py-7 sm:px-6 sm:py-10 ${toneClass}`}>
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
