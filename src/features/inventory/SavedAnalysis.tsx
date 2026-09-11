'use client';

import { useMemo, useState } from 'react';

import { ListingLink } from '@/features/analyze/ListingLink';
import { ResultView } from '@/features/analyze/ResultView';
import type { AnalysisSnapshot } from '@/schemas/snapshot';
import { assessFlip } from '@/services/valuation/flip-score';
import { usePersistAskingPrice } from './useAskingPrice';

/**
 * Un'analisi salvata, riaperta: la stessa pagina di quando e' uscita.
 *
 * Prima l'analisi viveva nello stato del browser e la scheda salvata era una
 * versione ridotta: riaprire un oggetto voleva dire vedere un'altra pagina,
 * piu' povera, della stessa cosa. Ora e' la stessa pagina, e il verdetto si
 * ricalcola qui — non era stato congelato apposta, perche' e' funzione del
 * prezzo che stai digitando adesso, non di quello di ieri.
 */
export function SavedAnalysis({
  itemId,
  snapshot,
  coverUrl,
  initialAskingPrice,
  listing = null,
}: {
  itemId: string;
  snapshot: AnalysisSnapshot;
  coverUrl: string | null;
  initialAskingPrice: number | null;
  /** L'annuncio da cui era nata, se non era nata da una fotografia. */
  listing?: { url: string; source: 'vinted' | 'ebay' } | null;
}) {
  const iniziale = initialAskingPrice === null ? '' : String(initialAskingPrice);
  const [price, setPrice] = useState(iniziale);
  usePersistAskingPrice(itemId, price, iniziale);

  const result = useMemo(() => {
    const parsed = price.trim() === '' ? null : Number(price.replace(',', '.'));
    const valid = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    return {
      ...snapshot,
      flip: assessFlip(snapshot.identification, snapshot.market, snapshot.valuation, valid),
    };
  }, [snapshot, price]);

  return (
    <ResultView
      result={result}
      coverUrl={coverUrl}
      purchasePrice={price}
      onPurchasePriceChange={setPrice}
      /* Nella stessa fessura dell'analisi appena fatta, cioe' subito sotto il
         nome dell'oggetto: e' da li' che viene, e stava in fondo alla pagina
         dopo tutte le prove — l'ultimo posto in cui si cerca la provenienza. */
      listingSlot={<ListingLink listing={listing} />}
    />
  );
}
