'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * La navigazione del telefono sta in basso, dove arriva il pollice.
 *
 * Le voci erano tre e stavano in una barra in alto: sopra i 390px ci
 * stavano appena, e la quarta — l'andamento — non ci sarebbe entrata senza
 * mandare il logo a capo. Ma il problema non era lo spazio: era che questa
 * app si usa in piedi, con una mano sola, e il bordo alto di uno schermo da
 * sei pollici e' il punto piu' lontano dal pollice che ci sia.
 *
 * Sopra il breakpoint `sm` sparisce e torna la barra in alto: su un desktop
 * una barra incollata in fondo allo schermo non e' vicina a niente.
 */
const VOCI = [
  { href: '/analizza', label: 'Analizza', icon: CameraIcon },
  { href: '/inventario', label: 'Inventario', icon: BoxIcon },
  { href: '/andamento', label: 'Andamento', icon: ChartIcon },
  { href: '/account', label: 'Account', icon: PersonIcon },
] as const;

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
      <path d="M3 8.5 12 13l9-4.5M12 13v7" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.5c1.4-3.2 4-4.8 6.5-4.8s5.1 1.6 6.5 4.8" />
    </svg>
  );
}

/**
 * Il segno che il tocco e' arrivato, dentro il `<Link>` come vuole
 * `useLinkStatus`. Occupa spazio anche da spento, cosi' l'etichetta non si
 * sposta sotto il dito.
 */
function Pallino() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`mt-0.5 block h-1 w-1 rounded-full bg-current ${
        pending ? 'pending-dot visible' : 'invisible'
      }`}
    />
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex">
        {VOCI.map((voce) => {
          const attiva = pathname === voce.href || pathname.startsWith(`${voce.href}/`);
          return (
            <li key={voce.href} className="flex-1">
              <Link
                href={voce.href}
                aria-current={attiva ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-semibold transition ${
                  attiva ? 'text-foreground' : 'text-muted'
                }`}
              >
                {/* L'attiva si riconosce dal blocco pieno dietro l'icona, non
                    da una sfumatura di grigio: a un metro di distanza e con lo
                    schermo al sole, il colore e' l'unica cosa che si vede. */}
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-[0.5rem] border-2 ${
                    attiva ? 'border-line bg-tile-teal text-tile-cream' : 'border-transparent'
                  }`}
                >
                  <voce.icon />
                </span>
                {voce.label}
                <Pallino />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
