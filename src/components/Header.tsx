'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Il segno che il tocco e' arrivato.
 *
 * `useLinkStatus` va usato dentro un `<Link>` e dice se quella navigazione e'
 * ancora in volo. Serve per i casi in cui il prefetch non e' arrivato in
 * tempo: dove c'e' un `loading.tsx` la pagina cambia subito e questo punto
 * non compare nemmeno, che e' il comportamento giusto.
 *
 * Occupa spazio anche da spento — `visibility`, non `display` — perche' un
 * puntino che appare non deve spostare la voce di menu sotto il dito. E
 * l'animazione parte con 120 ms di ritardo: una navigazione veloce non
 * produce un lampo.
 */
function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle ${
        pending ? 'pending-dot visible' : 'invisible'
      }`}
    />
  );
}

/*
 * La voce attiva e' inchiostro, l'azione e' teal.
 *
 * Erano tutte e due teal piene, e su uno schermo grande «+ Analizza» e la
 * pagina in cui ti trovi diventavano due blocchi identici: il colore smetteva
 * di dire quale dei due era l'azione. Il nero non e' riservato a niente e si
 * distingue dal teal a un metro, che era il motivo per cui la voce attiva un
 * colore ce l'ha.
 */
/** Le voci «guarda cosa hai fatto». L'azione e' un pulsante a parte. */
const LINKS = [
  { href: '/inventario', label: 'Inventario' },
  { href: '/andamento', label: 'Andamento' },
] as const;

/**
 * Barra di navigazione fissa e fluttuante: non scompare mai, cosi' le tre
 * pagine dell'app si raggiungono da ovunque invece che tornando indietro un
 * passo alla volta.
 *
 * Ha il tratto e l'ombra dei blocchi, non piu' la pillola dal bordo tenue:
 * galleggia sopra il contenuto, e con un contorno appena accennato sembrava
 * appartenere alla pagina sotto invece che stare davanti a lei.
 */
export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:top-3 sm:px-5 sm:pt-0">
      {/*
        Sul telefono resta solo il marchio, e serve a una cosa che la barra in
        basso non fa: riportare alla home. Spostando la navigazione in fondo
        l'avevo tolta del tutto, e una volta dentro l'app non c'era piu' modo
        di uscirne. Una riga alta quaranta pixel e' il prezzo giusto per non
        avere un vicolo cieco.
      */}
      <Link
        href="/"
        className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-block border-2 border-line bg-surface/95 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] shadow-pop-sm backdrop-blur sm:hidden"
      >
        <span className="h-2.5 w-2.5 rounded-[0.2rem] border-2 border-line bg-tile-teal" aria-hidden />
        STYMA
      </Link>

      <nav className="mx-auto hidden w-full max-w-2xl items-center justify-between gap-1 rounded-block border-2 border-line bg-surface/95 px-1.5 py-1.5 shadow-pop-sm backdrop-blur sm:flex sm:px-2 sm:py-2">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded-[0.5rem] px-2 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.2em]"
        >
          <span className="h-2.5 w-2.5 rounded-[0.2rem] border-2 border-line bg-tile-teal" aria-hidden />
          {/* Sotto i 360px logo, due voci e account non ci stanno in fila:
              resta il pallino, che porta a casa lo stesso. */}
          <span className="hidden min-[360px]:inline">STYMA</span>
          <span className="sr-only min-[360px]:hidden">STYMA</span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {/*
            L'azione principale ha la forma di un pulsante anche qui. Sul
            telefono sporge dalla barra in basso; su uno schermo grande non
            c'e' una barra da cui sporgere, ma resta vero che questa app fa
            una cosa sola e le altre voci servono a guardare cosa ha fatto.
          */}
          <Link
            href="/analizza"
            className="mr-1 inline-flex items-center gap-1.5 rounded-[0.5rem] border-2 border-line bg-tile-teal px-3.5 py-2 text-sm font-semibold text-tile-cream shadow-pop-sm transition-[transform,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <span aria-hidden className="text-base leading-none">+</span>
            Analizza
            <LinkPending />
          </Link>

          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-[0.5rem] px-2.5 py-2 text-[13px] font-semibold transition sm:px-3.5 sm:text-sm ${
                  active
                    ? 'border-2 border-line bg-foreground text-background'
                    : 'border-2 border-transparent text-muted hover:bg-accent-soft hover:text-foreground'
                }`}
              >
                {link.label}
                <LinkPending />
              </Link>
            );
          })}
          <Link
            href="/account"
            aria-label="Account"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5rem] transition ${
              pathname === '/account'
                ? 'border-2 border-line bg-foreground text-background'
                : 'border-2 border-transparent text-muted hover:bg-accent-soft hover:text-foreground'
            }`}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 19.5c1.4-3.2 4-4.8 6.5-4.8s5.1 1.6 6.5 4.8" />
            </svg>
            <LinkPending />
          </Link>
        </div>
      </nav>
    </header>
  );
}
