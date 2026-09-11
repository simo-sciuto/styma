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
/**
 * Due voci, il pulsante, due voci.
 *
 * L'analisi era una voce come le altre, e con l'arrivo dei link ha smesso di
 * essere «una delle cose che fa l'app»: e' la cosa che fa l'app, da un banco
 * o dal divano. Un pulsante che sporge dalla barra lo dice senza scriverlo, e
 * sta in mezzo perche' li' arriva il pollice di tutte e due le mani.
 *
 * La home rientra qui e non solo in cima: serve a chiudere la simmetria
 * attorno al pulsante, e in fondo allo schermo e' piu' vicina di quanto sia
 * mai stata in alto.
 */
const PRIMA = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/inventario', label: 'Inventario', icon: BoxIcon },
] as const;

const DOPO = [
  { href: '/andamento', label: 'Andamento', icon: ChartIcon },
  { href: '/account', label: 'Account', icon: PersonIcon },
] as const;

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />
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

function Voce({
  href,
  label,
  icon: Icona,
  attiva,
}: {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  attiva: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={attiva ? 'page' : undefined}
        className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-semibold transition ${
          attiva ? 'text-foreground' : 'text-muted'
        }`}
      >
        {/* L'attiva si riconosce dal blocco pieno dietro l'icona, non da una
            sfumatura di grigio: a un metro di distanza e con lo schermo al
            sole, il contrasto e' l'unica cosa che si vede. Inchiostro e non
            teal, perche' il teal e' del pulsante dell'azione e due blocchi
            dello stesso colore smettono di dire quale dei due e' l'azione. */}
        <span
          className={`flex h-8 w-12 items-center justify-center rounded-[0.5rem] border-2 ${
            attiva ? 'border-line bg-foreground text-background' : 'border-transparent'
          }`}
        >
          <Icona />
        </span>
        {label}
        <Pallino />
      </Link>
    </li>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const attiva = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex items-end">
        {PRIMA.map((voce) => (
          <Voce key={voce.href} {...voce} attiva={attiva(voce.href)} />
        ))}

        {/*
          Il pulsante sporge sopra la barra. Non e' decorazione: in una fila
          di icone tutte uguali l'azione principale non si distingue, e questa
          app esiste per farne una sola. Il margine negativo lo alza, e il
          bordo dello stesso colore della barra ritaglia il cerchio dal
          contorno invece di sovrapporvisi.
        */}
        <li className="flex w-20 shrink-0 justify-center">
          <Link
            href="/analizza"
            aria-current={attiva('/analizza') ? 'page' : undefined}
            className="-mt-7 flex flex-col items-center gap-1"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-line shadow-pop-sm transition-[transform,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
                attiva('/analizza')
                  ? 'bg-verdict-buy text-tile-ink'
                  : 'bg-tile-teal text-tile-cream'
              }`}
            >
              <PlusIcon />
            </span>
            <span className="text-[0.65rem] font-semibold">Analizza</span>
            <Pallino />
          </Link>
        </li>

        {DOPO.map((voce) => (
          <Voce key={voce.href} {...voce} attiva={attiva(voce.href)} />
        ))}
      </ul>
    </nav>
  );
}

/** Un piu', non una macchina fotografica: l'oggetto puo' arrivare da un link. */
function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
