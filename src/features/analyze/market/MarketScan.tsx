'use client';

import type { MarketSource, Valuation, WeightedComparable } from '@/schemas/analysis';
import type { Identification } from '@/schemas/identification';
import type { MarketResearch } from '@/schemas/market';
import { ebaySoldSearchUrl } from '@/services/market-data/ebay/queries';
import {
  DEMAND_LABELS,
  LIQUIDITY_LABELS,
  MATCH_LABELS,
  PRICE_KIND_LABELS,
  formatDate,
  formatEur,
} from '@/lib/format';
import { Card, Disclosure, Pill } from '@/components/ui';

/** Quante inserzioni mostrare aperte. Le altre restano, ma piegate. */
const STRONGEST = 4;

/**
 * L'eta' della ricerca si dichiara sempre, anche quando e' di oggi. Chi decide
 * davanti a un banco deve sapere se sta guardando il mercato di adesso o quello
 * di tre settimane fa: nasconderlo sarebbe far sembrare fresco un dato riusato.
 */
function describeSource(source: MarketSource): string {
  if (!source.cached) return 'Ricerca fatta adesso.';
  if (source.ageDays === 0) return 'Ricerca riusata, fatta oggi per lo stesso modello.';
  if (source.ageDays === 1) return 'Ricerca riusata, fatta ieri per lo stesso modello.';
  return `Ricerca riusata, fatta ${source.ageDays} giorni fa per lo stesso modello.`;
}

function ComparableRow({ item, showKind }: { item: WeightedComparable; showKind: boolean }) {
  const { comparable } = item;
  const date = formatDate(comparable.soldAt);

  return (
    <li className="border-t border-line py-3 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-lg font-semibold">{formatEur(item.priceEur)}</span>
        <span className="shrink-0 text-xs text-muted">{comparable.source}</span>
      </div>

      <a
        href={comparable.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-0.5 block text-sm underline decoration-line underline-offset-4"
      >
        {comparable.title}
      </a>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Pill tone={comparable.matchLevel === 'exact_model' ? 'accent' : 'neutral'}>
          {MATCH_LABELS[comparable.matchLevel]}
        </Pill>
        {/* Il peso si mostra perche' e' il motivo per cui questa inserzione
            ha spostato la stima piu' o meno di un'altra: senza, l'elenco
            sembrerebbe una media di cose messe sullo stesso piano. */}
        <span className="font-mono text-xs text-muted">peso {item.weight.toFixed(2)}</span>
        {showKind ? (
          <Pill tone={comparable.kind === 'sold' ? 'accent' : comparable.kind === 'bid' ? 'warn' : 'neutral'}>
            {PRICE_KIND_LABELS[comparable.kind]}
          </Pill>
        ) : null}
        {date ? <span className="text-xs text-muted">{date}</span> : null}
      </div>

      {comparable.notes ? <p className="mt-1.5 text-xs text-muted">{comparable.notes}</p> : null}
    </li>
  );
}

/**
 * Le inserzioni su cui poggia la stima, come prova invece che come dettaglio
 * tecnico.
 *
 * Stavano dentro due accordion chiusi accanto ad altri quattro: chi voleva
 * capire da dove veniva il numero doveva sapere di dover aprire qualcosa. Le
 * piu' forti stanno aperte, il resto si piega — mostrarne trenta sarebbe
 * scaricare su chi legge il lavoro di scegliere quali contano.
 */
export function MarketScan({
  valuation,
  market,
  marketSource,
  identification,
}: {
  valuation: Extract<Valuation, { available: true }>;
  market: MarketResearch | null;
  marketSource: MarketSource | null;
  identification: Identification;
}) {
  const soldSearch = ebaySoldSearchUrl(identification);

  /*
   * Il pavimento: fin dove qualcuno si e' gia' spinto davvero.
   *
   * Le aste aperte non entrano nella stima — l'offerta di adesso non e' un
   * prezzo di vendita — ma sono l'unica cosa in questa pagina per cui
   * qualcuno ha tirato fuori dei soldi, e vale piu' di trenta prezzi sperati.
   */
  const bids = valuation.discarded.filter((entry) => entry.comparable.kind === 'bid');
  const highestBid = bids.length > 0 ? Math.max(...bids.map((e) => e.comparable.price)) : null;
  const used = [...valuation.used].sort((a, b) => b.weight - a.weight);
  const strongest = used.slice(0, STRONGEST);
  const rest = used.slice(STRONGEST);
  const { discarded } = valuation;

  // Sono tutti prezzi richiesti finche' non esiste una fonte di venduti: dirlo
  // una volta in testa e' piu' onesto che ripetere "Richiesto" su ogni riga,
  // dove diventa un'etichetta che non si legge piu'.
  const allAsking = used.every((item) => item.comparable.kind === 'asking');

  const identical = used.filter((item) => item.comparable.matchLevel === 'exact_model');
  const competition =
    identical.length >= 2
      ? {
          count: identical.length,
          low: Math.min(...identical.map((item) => item.priceEur)),
          high: Math.max(...identical.map((item) => item.priceEur)),
        }
      : null;

  const hasMarketRead =
    market !== null && (market.demand !== 'unknown' || market.liquidity !== 'unknown');

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Sul mercato
        </p>
        <p className="text-xs text-muted">
          {used.length === 1 ? '1 annuncio nella stima' : `${used.length} annunci nella stima`}
          {marketSource ? ` · ${describeSource(marketSource)}` : ''}
        </p>
      </div>

      {allAsking ? (
        <p className="mt-2 text-xs text-warn">
          Sono tutti prezzi <strong>richiesti</strong>, non vendite concluse: dicono a quanto
          qualcuno spera di vendere, non a quanto qualcuno ha comprato.
        </p>
      ) : null}

      {/*
        Le vendite concluse non entrano nella stima e non ci entreranno presto:
        le uniche fonti che le restituiscono sono scraper. Quello che si puo'
        fare senza mentire e' portarci chi sta davanti al banco — la sua
        ricerca, sul suo browser, sul sito di eBay.
      */}
      {soldSearch ? (
        <p className="mt-2 text-xs text-muted">
          <a
            href={soldSearch}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-foreground underline decoration-line underline-offset-4"
          >
            Guarda i venduti su eBay
          </a>{' '}
          — apre la ricerca sul sito, dove i prezzi sono quelli davvero pagati. Serve essere
          loggati su eBay: da luglio 2026 li mostra solo a chi ha un account.
        </p>
      ) : null}

      {highestBid !== null ? (
        <p className="mt-3 text-sm">
          Su {bids.length === 1 ? 'un’asta aperta' : `${bids.length} aste aperte`} qualcuno ha gia’
          offerto fino a <strong>{formatEur(highestBid)}</strong>. Non entra nella stima — l’asta
          non e’ finita — ma e’ l’unica cifra qui dentro che qualcuno ha davvero impegnato.
        </p>
      ) : null}

      {competition ? (
        <p className="mt-3 text-sm">
          <strong>{competition.count} inserzioni</strong> dello stesso modello sono aperte adesso,
          da {formatEur(competition.low)} a {formatEur(competition.high)}. E’ quanta scelta ha chi
          compra.
        </p>
      ) : null}

      {strongest.length > 0 ? (
        <ul className="mt-4">
          {strongest.map((item) => (
            <ComparableRow
              key={`${item.comparable.url}-${item.comparable.price}`}
              item={item}
              showKind={!allAsking}
            />
          ))}
        </ul>
      ) : null}

      {rest.length > 0 ? (
        <div className="mt-3">
          <Disclosure summary={`Gli altri ${rest.length}`}>
            <ul>
              {rest.map((item) => (
                <ComparableRow
                  key={`${item.comparable.url}-${item.comparable.price}`}
                  item={item}
                  showKind={!allAsking}
                />
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}

      {/* Come si e' arrivati da queste inserzioni a quella fascia. Stava in
          una scheda a se', staccata dagli annunci di cui parla. */}
      {valuation.reasons.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Come siamo arrivati alla fascia
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {valuation.reasons.map((reason) => (
              <li key={reason}>— {reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Cosa e' stato buttato e perche'. E' la meta' meno vistosa della
          prova, e l'unica che dimostra che qualcuno ha guardato. */}
      {discarded.length > 0 ? (
        <div className="mt-3">
          <Disclosure summary={`${discarded.length} scartati, e perche’`}>
            <ul className="space-y-2 text-sm text-muted">
              {discarded.map(({ comparable, reason }) => (
                <li key={`${comparable.url}-${comparable.price}`}>
                  <span className="text-foreground">{comparable.title}</span> — {reason}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}

      {hasMarketRead ? (
        <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
          Domanda {DEMAND_LABELS[market.demand]} · {LIQUIDITY_LABELS[market.liquidity]}
        </p>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          Domanda e tempi di vendita non osservati: servirebbero le vendite concluse, e non esiste
          una fonte gratuita che ce le dia.
        </p>
      )}

      {market !== null && market.notes.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {market.notes.map((note) => (
            <li key={note}>— {note}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
