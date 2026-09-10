import type { ComponentProps, ReactNode } from 'react';

/**
 * Il livello di un blocco, cioe' quanto conta rispetto a quelli accanto.
 *
 * Prima non esisteva: `Card` aveva un aspetto solo, quindi una pagina di
 * undici schede era una pagina di undici cose ugualmente importanti, e chi
 * legge doveva stabilire da solo quale guardare per prima. Con tre livelli
 * la risposta e' gia' nella forma, e si legge da lontano — che e' la
 * condizione vera d'uso: un telefono, in mano, al sole, con qualcuno che
 * aspetta.
 *
 *   1  la risposta   bordo spesso, ombra piena, colore pieno dal chiamante
 *   2  le prove      bordo spesso, fondo chiaro, niente ombra
 *   3  il resto      nessuna scatola, solo un filo sopra
 *
 * Il livello 3 non e' una scheda smorta: e' l'assenza di scheda. Una scatola
 * tenue attorno a «Cos'e', in breve» direbbe comunque «sono un blocco come
 * gli altri», solo detto piano.
 */
export type CardLevel = 1 | 2 | 3;

const CARD_LEVELS: Record<CardLevel, string> = {
  1: 'rounded-block border-[3px] border-line shadow-pop p-5 sm:p-6',
  2: 'rounded-block border-2 border-line bg-surface p-5 sm:p-6',
  3: 'border-t-2 border-line pt-5',
};

export function Card({
  children,
  className = '',
  level = 2,
  ...props
}: ComponentProps<'section'> & { children: ReactNode; level?: CardLevel }) {
  return (
    <section className={`${CARD_LEVELS[level]} ${className}`} {...props}>
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
    neutral: 'bg-surface text-muted',
    accent: 'bg-accent-vivid text-accent-on-vivid',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-[0.4rem] border-2 border-line px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
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
  /*
   * Il bottone si preme davvero: sotto il dito scende di tre pixel e
   * l'ombra sparisce sotto di lui. E' l'unica animazione di stato che
   * questo sistema si concede, e non e' decorazione — su un telefono
   * tenuto in una mano sola, con l'altra sull'oggetto, il tocco che
   * "affonda" e' l'unica conferma che arriva prima della risposta.
   *
   * Da spento l'ombra non c'e': un bottone disabilitato che proietta come
   * uno acceso e' un bottone che invita a premere e non risponde.
   */
  const variants = {
    primary: 'bg-tile-teal text-tile-cream',
    ghost: 'bg-surface text-foreground hover:bg-accent-soft',
  } as const;

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-block border-[3px] border-line px-6 py-3 text-base font-semibold transition-[transform,box-shadow] duration-100 shadow-pop-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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

/**
 * Il contenuto che si apre solo se ti viene un dubbio.
 *
 * Ha il bordo dei blocchi ma non il loro fondo: chiuso pesa meno di una
 * scheda piena, aperto ne ha lo stesso peso. E' la forma giusta per una
 * cosa la cui importanza dipende da chi legge, invece di essere decisa qui.
 */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-block border-2 border-line">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold marker:hidden sm:px-5">
        <span className="flex items-center justify-between gap-3">
          {summary}
          <span className="text-muted transition group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t-2 border-line bg-surface px-4 py-4 text-sm sm:px-5">{children}</div>
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
    <div className={`rounded-block border-[3px] border-line px-5 py-7 shadow-pop sm:px-6 sm:py-10 ${toneClass}`}>
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
