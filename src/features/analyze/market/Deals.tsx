'use client';

import type { PriceThresholds, Valuation } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { findDeals } from '@/services/valuation/deals';
import { Card } from '@/components/ui';

/**
 * I nomi dei paesi che eBay restituisce come sigla. Solo quelli che compaiono
 * davvero: misurando cinque mercati su un oggetto reale sono tornati venditori
 * da nove paesi, Giappone compreso — sedici inserzioni su cento.
 */
const PAESI: Record<string, string> = {
  IT: 'Italia',
  DE: 'Germania',
  FR: 'Francia',
  GB: 'Regno Unito',
  ES: 'Spagna',
  NL: 'Paesi Bassi',
  AT: 'Austria',
  DK: 'Danimarca',
  BE: 'Belgio',
  PT: 'Portogallo',
  CH: 'Svizzera',
  PL: 'Polonia',
  JP: 'Giappone',
  US: 'Stati Uniti',
};

function paese(code: string | null | undefined): string | null {
  if (!code) return null;
  return PAESI[code] ?? code;
}

/**
 * Lo stesso oggetto, in vendita adesso sotto il tuo prezzo massimo.
 *
 * E' l'unico blocco della pagina che non serve a decidere su questo oggetto:
 * serve a dire che forse non e' questo l'oggetto da comprare. Le inserzioni
 * sono le stesse che hanno prodotto la stima — nessuna chiamata in piu',
 * nessun costo — lette per quello che sono anche state tutto il tempo: cose
 * comprabili. Sotto la cifra che due riquadri piu' su abbiamo chiamato «paga
 * fino a», quella e' per definizione un'occasione.
 *
 * Il blocco non compare quasi mai, ed e' giusto cosi': perche' compaia serve
 * che qualcuno stia vendendo lo stesso identico modello a prezzo fisso sotto
 * il massimo, il che sul mercato vero e' raro. Un blocco che c'e' sempre
 * insegna a saltarlo; uno che compare tre volte su cento si legge.
 */
export function Deals({
  valuation,
  thresholds,
}: {
  valuation: Valuation;
  thresholds: PriceThresholds;
}) {
  const deals = findDeals(valuation, thresholds);
  if (deals.length === 0) return null;

  return (
    <Card className="bg-accent-soft">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent">
        Lo trovi gia’ in vendita
      </p>
      <p className="mt-2 text-sm">
        Lo stesso modello, in vendita adesso sotto il tuo massimo di{' '}
        <strong>{formatEur(thresholds.buyUpTo ?? 0)}</strong>.
      </p>

      <ul className="mt-4 space-y-3">
        {deals.map((deal) => {
          const da = paese(deal.comparable.country);
          return (
            <li
              key={deal.comparable.url}
              className="flex gap-3 rounded-block border-2 border-line bg-surface p-3"
            >
              {deal.comparable.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deal.comparable.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-[0.5rem] border-2 border-line object-cover"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {formatEur(deal.priceEur)}
                  </span>
                  {/*
                    La spedizione si somma solo dove la conosciamo davvero.
                    eBay dichiara il costo verso il paese del mercato che stai
                    interrogando: su un'inserzione trovata su eBay.de quella
                    cifra e' quanto pagherebbe un tedesco, e sommarla qui
                    darebbe un totale che parla di qualcun altro.
                  */}
                  {deal.landedEur !== null ? (
                    <span className="font-mono text-xs text-muted">
                      + {formatEur(deal.landedEur - deal.priceEur)} sped. ={' '}
                      <strong className="text-foreground">{formatEur(deal.landedEur)}</strong>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">spedizione a parte</span>
                  )}
                </p>

                <a
                  href={deal.comparable.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 line-clamp-2 block text-sm underline decoration-line underline-offset-4"
                >
                  {deal.comparable.title}
                </a>

                <p className="mt-1 text-xs text-muted">
                  {da ? `Spedisce da ${da} · ` : ''}
                  {formatEur(deal.underByEur)} sotto il tuo massimo
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t-2 border-line pt-3 text-xs text-muted">
        Guarda la foto prima di fidarti: il titolo non distingue l’oggetto da un suo pezzo.
      </p>
    </Card>
  );
}
