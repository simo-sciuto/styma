'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { ResultView } from '@/features/analyze/ResultView';
import type { AnalysisSnapshot } from '@/schemas/snapshot';
import { assessFlip } from '@/services/valuation/flip-score';
import { setAskingPrice } from './actions';

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
}: {
  itemId: string;
  snapshot: AnalysisSnapshot;
  coverUrl: string | null;
  initialAskingPrice: number | null;
}) {
  const [price, setPrice] = useState(
    initialAskingPrice === null ? '' : String(initialAskingPrice),
  );

  const result = useMemo(() => {
    const parsed = price.trim() === '' ? null : Number(price.replace(',', '.'));
    const valid = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    return {
      ...snapshot,
      flip: assessFlip(snapshot.identification, snapshot.market, snapshot.valuation, valid),
    };
  }, [snapshot, price]);

  /**
   * Il prezzo del banco si salva mentre lo scrivi, ma non a ogni tasto: una
   * scrittura per cifra digitata sarebbe cinque scritture per "18,50" e
   * quattro numeri sbagliati salvati per strada.
   */
  const primo = useRef(true);
  useEffect(() => {
    if (primo.current) {
      primo.current = false;
      return;
    }
    const parsed = price.trim() === '' ? null : Number(price.replace(',', '.'));
    const valid = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    const timer = setTimeout(() => void setAskingPrice(itemId, valid), 900);
    return () => clearTimeout(timer);
  }, [itemId, price]);

  return (
    <ResultView
      result={result}
      coverUrl={coverUrl}
      purchasePrice={price}
      onPurchasePriceChange={setPrice}
    />
  );
}
