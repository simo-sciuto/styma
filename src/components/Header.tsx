'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/analizza', label: 'Analizza' },
  { href: '/inventario', label: 'Inventario' },
] as const;

/**
 * Barra di navigazione fissa e fluttuante, come sul sito di riferimento:
 * un pillolone che non scompare mai, cosi' le tre pagine dell'app si
 * raggiungono da ovunque invece che tornando indietro un passo alla volta.
 */
export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-3 z-40 px-4 sm:px-5">
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between gap-1 rounded-full border border-line bg-surface/95 px-1.5 py-1.5 shadow-sm backdrop-blur sm:px-2 sm:py-2">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.2em]"
        >
          <span className="h-2 w-2 rounded-full bg-tile-teal" aria-hidden />
          {/* Sotto i 360px logo, due voci e account non ci stanno in fila:
              resta il pallino, che porta a casa lo stesso. */}
          <span className="hidden min-[360px]:inline">STYMA</span>
          <span className="sr-only min-[360px]:hidden">STYMA</span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-2.5 py-2 text-[13px] font-medium transition sm:px-3.5 sm:text-sm ${
                  active
                    ? 'bg-tile-teal text-tile-cream'
                    : 'text-muted hover:bg-accent-soft hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/account"
            aria-label="Account"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              pathname === '/account'
                ? 'bg-tile-teal text-tile-cream'
                : 'text-muted hover:bg-accent-soft hover:text-foreground'
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
          </Link>
        </div>
      </nav>
    </header>
  );
}
