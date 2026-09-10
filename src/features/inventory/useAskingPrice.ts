'use client';

import { useEffect, useRef } from 'react';

import { setAskingPrice } from './actions';

/** Pausa dalla digitazione prima di scrivere. Per "18,50" sarebbero cinque scritture. */
const PAUSA_MS = 900;

/**
 * Tiene aggiornato nel database il prezzo che stai digitando.
 *
 * Serve perche' l'analisi si salva da sola appena finisce, cioe' prima che tu
 * abbia scritto quanto te lo chiedono: senza questo, l'unico numero che rende
 * il verdetto utile non arriverebbe mai fino all'oggetto salvato.
 *
 * Il confronto e' con **l'ultimo valore scritto davvero**, non con "e' la
 * prima esecuzione dell'effetto". Il guardiano sulla prima esecuzione sembrava
 * equivalente e non lo era: in sviluppo React monta ogni effetto due volte, il
 * primo giro lo consumava, e il secondo scriveva il valore iniziale — cioe'
 * azzerava il prezzo appena salvato dalla pagina precedente. Un e2e l'ha
 * trovato in un minuto, tre livelli di test non l'avevano visto.
 *
 * Cosi' invece l'effetto e' idempotente: rimontarlo quante volte si vuole non
 * scrive niente finche' il valore non cambia davvero.
 */
export function usePersistAskingPrice(
  itemId: string | null,
  value: string,
  initial: string,
): void {
  const salvato = useRef(initial);

  useEffect(() => {
    if (!itemId || value === salvato.current) return;

    const timer = setTimeout(() => {
      const parsed = value.trim() === '' ? null : Number(value.replace(',', '.'));
      const price = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

      void setAskingPrice(itemId, price).then((result) => {
        // Solo se il database l'ha accettato: altrimenti il prossimo giro
        // deve riprovare, non credere di avere gia' scritto.
        if (result.ok) salvato.current = value;
      });
    }, PAUSA_MS);

    return () => clearTimeout(timer);
  }, [itemId, value]);
}
