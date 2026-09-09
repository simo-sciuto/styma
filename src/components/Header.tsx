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
    <header className="sticky top-3 z-40 px-5">
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between gap-1 rounded-full border border-line bg-surface/95 px-2 py-2 shadow-sm backdrop-blur">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-foreground"
        >
          <span className="h-2 w-2 rounded-full bg-tile-teal" aria-hidden />
          STYMA
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
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
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
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
