import Link from 'next/link';

/**
 * Chiusura a tutta altezza e a tutto colore, come sul sito di riferimento
 * — ma con un colore diverso dall'hero (terracotta, non teal): l'apertura
 * e la chiusura non devono sembrare la stessa sezione ripetuta due volte.
 * Solo sulla home: le schermate operative non hanno bisogno di un finale
 * da leggere, hanno bisogno di restare scorribili.
 */
export function Footer() {
  return (
    <footer className="flex min-h-[70svh] flex-col justify-between overflow-hidden bg-tile-terracotta px-5 py-14 text-tile-ink sm:min-h-[85svh]">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em]">STYMA</p>
        <p className="mt-6 max-w-lg text-balance text-[clamp(2rem,1.6rem+2.8vw,3.75rem)] font-semibold leading-[0.95] tracking-tighter">
          Il prossimo oggetto strano ti aspetta al prossimo banco.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-end justify-between gap-6 border-t border-tile-ink/15 pt-6">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <Link href="/analizza" className="hover:underline">
            Analizza
          </Link>
          <Link href="/inventario" className="hover:underline">
            Inventario
          </Link>
          <Link href="/account" className="hover:underline">
            Account
          </Link>
        </nav>
        <p className="max-w-xs text-xs">
          Prezzi richiesti, non vendite concluse. Quando non lo sappiamo, lo diciamo.
        </p>
      </div>
    </footer>
  );
}
