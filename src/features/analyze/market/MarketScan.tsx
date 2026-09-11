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
import { Card, Pill } from '@/components/ui';

/**
 * Quante inserzioni mettere nella striscia.
 *
 * Dodici e non tutte: in orizzontale la quantita' non costa altezza, ma ogni
 * scheda porta una fotografia, e settanta immagini su una connessione da
 * mercatino sono un peso vero. Sono ordinate per peso, quindi le prime sono
 * quelle che hanno spostato la stima.
 */
const STRONGEST = 12;

/**
 * L'eta' della ricerca si dichiara sempre, anche quando e' di oggi. Chi decide
 * davanti a un banco deve sapere se sta guardando il mercato di adesso o quello
 * di tre settimane fa: nasconderlo sarebbe far sembrare fresco un dato riusato.
 */
function describeSource(source: MarketSource): string {
  if (!source.cached) return 'di adesso';
  if (source.ageDays === 0) return 'ricerca di oggi';
  if (source.ageDays === 1) return 'ricerca di ieri';
  return `ricerca di ${source.ageDays} giorni fa`;
}

/**
 * Un'inserzione, con la sua foto.
 *
 * La foto arriva da eBay su ogni inserzione — misurato, venti su venti — e
 * fino a ieri la buttavamo via, lasciando quattro righe di testo dove il
 * titolo eBay e' scritto per essere trovato da un motore di ricerca, non per
 * essere letto («OLIVETTI VALENTINE Schreibmaschine funktionstuchtig mit
 * Koffer»). Chi guarda deve poter dire in un secondo «questo e' il mio
 * oggetto» oppure «questa e' un'altra cosa», ed e' un giudizio che si fa con
 * gli occhi: e' l'unico controllo sui comparabili che il nostro codice non
 * puo' fare al posto suo.
 */
function ComparableCard({
  item,
  showKind,
  showWeight,
}: {
  item: WeightedComparable;
  showKind: boolean;
  showWeight: boolean;
}) {
  const { comparable } = item;
  const date = formatDate(comparable.soldAt);

  return (
    <li className="w-40 shrink-0 snap-start">
      <a
        href={comparable.url}
        target="_blank"
        rel="noreferrer noopener"
        className="flex h-full flex-col rounded-block border-2 border-line bg-surface"
      >
        {comparable.imageUrl ? (
          /* Non `next/image`: sono miniature da 225px gia' dimensionate da
             eBay, e passarle dall'ottimizzatore costerebbe una
             trasformazione a testa per non guadagnare un byte. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comparable.imageUrl}
            alt=""
            loading="lazy"
            className="h-28 w-full rounded-t-[0.75rem] border-b-2 border-line bg-background object-cover"
          />
        ) : null}

        <div className="flex flex-1 flex-col p-2.5">
          <p className="font-mono text-lg font-semibold tabular-nums">{formatEur(item.priceEur)}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug">{comparable.title}</p>

          <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
            <Pill tone={comparable.matchLevel === 'exact_model' ? 'accent' : 'neutral'}>
              {MATCH_LABELS[comparable.matchLevel]}
            </Pill>
            {showKind ? (
              <Pill
                tone={
                  comparable.kind === 'sold' ? 'accent' : comparable.kind === 'bid' ? 'warn' : 'neutral'
                }
              >
                {PRICE_KIND_LABELS[comparable.kind]}
              </Pill>
            ) : null}
          </div>

          {showWeight || date ? (
            <p className="mt-1 font-mono text-[0.65rem] text-muted">
              {[showWeight ? `peso ${item.weight.toFixed(2)}` : null, date].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </a>
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
  const mostrati = used.slice(0, STRONGEST);
  const rest = used.slice(STRONGEST);

  // Sono tutti prezzi richiesti finche' non esiste una fonte di venduti: dirlo
  // una volta in testa e' piu' onesto che ripetere "Richiesto" su ogni riga,
  // dove diventa un'etichetta che non si legge piu'.
  const allAsking = used.every((item) => item.comparable.kind === 'asking');

  /*
   * Il peso si mostra solo se cambia da una riga all'altra.
   *
   * Esisteva per spiegare perche' un'inserzione avesse spostato la stima piu'
   * di un'altra, ed e' un buon motivo — ma sulle ricerche vere leggeva
   * «peso 1.00» su tutte e quattro le righe aperte. Il peso e' il prodotto di
   * due fattori, e uno dei due, lo stato di conservazione, eBay lo dichiara
   * su 3 inserzioni su 20 (misurato sulla Browse API in produzione): sulle
   * altre 17 vale la stessa costante. Con una ricerca riuscita, dove tutti i
   * comparabili sono lo stesso modello, anche il primo fattore e' costante.
   *
   * Una colonna di numeri identici non e' trasparenza: e' rumore travestito
   * da informazione, e insegna a saltare la riga in cui sta — compresa la
   * volta in cui quel numero varia davvero e conta.
   *
   * Il conto si fa per elenco, non sull'insieme: le quattro righe aperte
   * possono valere tutte 1,00 mentre fra i settantaquattro piegati il peso
   * varia eccome, e guardare il totale rimetterebbe la colonna costante
   * proprio dove si legge.
   */
  const pesiVariano = (elenco: WeightedComparable[]) =>
    new Set(elenco.map((item) => item.weight.toFixed(2))).size > 1;

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
          {used.length} {used.length === 1 ? 'annuncio' : 'annunci'}
          {marketSource ? `, ${describeSource(marketSource)}` : ''}
          {allAsking ? ' · prezzi richiesti, non venduti' : ''}
        </p>
      </div>

      {/*
        Le vendite concluse non entrano nella stima e non ci entreranno presto:
        le uniche fonti che le restituiscono sono scraper. Quello che si puo'
        fare senza mentire e' portarci chi sta davanti al banco: la sua
        ricerca, sul suo browser, sul sito di eBay.
      */}
      {soldSearch ? (
        <p className="mt-2 text-xs">
          <a
            href={soldSearch}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline decoration-line underline-offset-4"
          >
            Guarda i venduti su eBay
          </a>{' '}
          <span className="text-muted">(serve l’account)</span>
        </p>
      ) : null}

      {highestBid !== null ? (
        <p className="mt-3 text-sm">
          Su {bids.length === 1 ? 'un’asta aperta' : `${bids.length} aste aperte`} qualcuno ha gia’
          offerto fino a <strong>{formatEur(highestBid)}</strong>. L’asta non e’ finita, quindi e’
          un pavimento e non entra nella stima.
        </p>
      ) : null}

      {competition ? (
        <p className="mt-3 text-sm">
          La tua concorrenza: <strong>{competition.count} inserzioni</strong> dello stesso modello
          aperte adesso, da {formatEur(competition.low)} a {formatEur(competition.high)}.
        </p>
      ) : null}

      {/*
        Una striscia che scorre, non un elenco lungo.
        Quattro annunci aperti e settanta chiusi in un accordion erano due
        decisioni prese al posto di chi legge: quali contano, e quanti ne puo'
        reggere. In orizzontale la quantita' non costa niente in altezza, si
        scorre col pollice come su qualunque altra app, e le foto — che sono
        il modo in cui uno riconosce il proprio oggetto — stanno grandi
        invece che in miniatura di lato.
      */}
      {mostrati.length > 0 ? (
        <ul className="-mx-5 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
          {mostrati.map((item) => (
            <ComparableCard
              key={`${item.comparable.url}-${item.comparable.price}`}
              item={item}
              showKind={!allAsking}
              showWeight={pesiVariano(mostrati)}
            />
          ))}
        </ul>
      ) : null}

      {rest.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Nella stima ne sono entrati {used.length}: qui ci sono i {mostrati.length} che pesano di
          piu’.
        </p>
      ) : null}

      {/* Come si e' arrivati da queste inserzioni a quella fascia. Stava in
          una scheda a se', staccata dagli annunci di cui parla. */}
      {valuation.reasons.length > 0 ? (
        <div className="mt-4 border-t-2 border-line pt-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
Come nasce la stima
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {valuation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasMarketRead ? (
        <p className="mt-4 border-t-2 border-line pt-3 text-sm text-muted">
          Domanda {DEMAND_LABELS[market.demand]} · {LIQUIDITY_LABELS[market.liquidity]}
        </p>
      ) : null}

      {market !== null && market.notes.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {market.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
