'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui';
import { deleteItem } from './actions';

/**
 * Cancellare un oggetto dalla lista, con la domanda in mezzo.
 *
 * Per molto tempo qui non c'era niente, e non per dimenticanza: un oggetto
 * scartato e' il dato che dice se un «lascia stare» era giusto, ed e' la
 * meta' di magazzino piu' difficile da raccogliere. Quella ragione vale
 * ancora, e non basta a decidere al posto di chi il magazzino ce l'ha.
 * `archived_at` resta il gesto normale — «toglilo dalla lista», reversibile,
 * sulla scheda dell'oggetto; questo e' l'altro, e non torna indietro.
 *
 * Il freno e' la domanda, non l'assenza del bottone. E la domanda nomina
 * l'oggetto: «cancellare questo elemento?» si conferma senza leggere, «vuoi
 * cancellare Olivetti Valentine?» no — chi ha toccato la crocetta sbagliata
 * se ne accorge li'.
 *
 * Il `<dialog>` e' quello vero: Escape, fuoco intrappolato dentro e resto
 * della pagina inerte arrivano dal browser, e rifarli a mano vuol dire
 * rifarli peggio.
 */
export function DeleteItem({ itemId, title }: { itemId: string; title: string }) {
  const [aperta, setAperta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aperta && !dialog.open) dialog.showModal();
    if (!aperta && dialog.open) dialog.close();
  }, [aperta]);

  function cancella() {
    setError(null);
    startTransition(async () => {
      const result = await deleteItem(itemId);
      // Se e' andata, la riga sparisce da sola quando la pagina si rigenera:
      // chiudere qui la finestra su una lista che non si e' ancora aggiornata
      // farebbe lampeggiare l'oggetto appena cancellato.
      if (!result.ok) setError(result.error);
      else setAperta(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAperta(true)}
        aria-label={`Cancella ${title}`}
        /* Fuori dal <Link> che avvolge la scheda: un bottone dentro un
           collegamento non e' HTML valido, e il tocco finirebbe per aprire
           l'oggetto invece di chiedere. Sta sopra, in un angolo, e si vede
           solo quanto basta per trovarlo. */
        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-line bg-surface text-sm leading-none text-muted transition hover:bg-danger-soft hover:text-danger"
      >
        <span aria-hidden>✕</span>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setAperta(false)}
        /* Su <dialog> il clic sullo sfondo ha come bersaglio il dialog
           stesso: non serve un secondo elemento a coprire lo schermo. */
        onClick={(event) => {
          if (event.target === dialogRef.current && !pending) setAperta(false);
        }}
        className="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-block border-[3px] border-line bg-background p-5 text-foreground shadow-pop backdrop:bg-foreground/40"
      >
        <p className="text-xl font-semibold tracking-tight text-balance">
          Cancellare {title}?
        </p>
        {/* Cosa sparisce, in concreto. «Questa azione e' irreversibile» e' una
            formula: elencare le tre cose che si perdono e' l'informazione. */}
        <p className="mt-2 text-sm text-muted">
          Spariscono l’analisi, le foto e quello che hai registrato. Non si torna indietro.
        </p>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="danger" pending={pending} onClick={cancella}>
            Cancella
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setAperta(false)}>
            Annulla
          </Button>
        </div>
      </dialog>
    </>
  );
}
