'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { ITEM_STATUS_LABELS, type ItemStatus } from '@/services/inventory/types';

/**
 * Cercare e filtrare, al posto dei totali.
 *
 * In cima all'inventario c'era il cruscotto in miniatura: quanti oggetti,
 * quanto valgono, quanto hai speso, quanto ci guadagnerai. Erano gli stessi
 * numeri di `/andamento`, detti peggio perche' senza il tempo, e occupavano
 * la meta' alta di una pagina che serve a una cosa sola: trovare un oggetto
 * fra quaranta.
 *
 * Il filtro lavora sulle righe gia' caricate, senza tornare al server: la
 * lista sta tutta nella pagina, e un giro di rete per nascondere delle righe
 * che il browser ha gia' in mano e' tempo regalato.
 *
 * I conteggi stanno sulle linguette e non in un blocco a parte. Sono la stessa
 * informazione — quanti ne hai e in che stato — detta dove serve, cioe'
 * mentre scegli quale gruppo guardare.
 *
 * La scheda arriva gia' resa dal server. La prima versione la chiedeva con un
 * render-prop, e una funzione non attraversa il confine fra server e client:
 * «Functions are not valid as a child of Client Components», e la lista
 * spariva. Un nodo gia' reso invece viaggia, perche' e' dato — e cosi' le
 * foto, i link e i prezzi restano lavoro del server, che e' dove stavano.
 * Qui si sceglie solo quali mostrare.
 */
export type FiltrabileItem = {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  status: ItemStatus;
  scheda: ReactNode;
};

/** Gli stati, nell'ordine in cui un oggetto li attraversa. */
const ORDINE: ItemStatus[] = ['found', 'bought', 'listed', 'sold', 'passed'];

function normalizza(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function InventoryFilters({ items }: { items: FiltrabileItem[] }) {
  const [testo, setTesto] = useState('');
  const [stato, setStato] = useState<ItemStatus | null>(null);

  const conteggi = useMemo(() => {
    const mappa = new Map<ItemStatus, number>();
    for (const item of items) mappa.set(item.status, (mappa.get(item.status) ?? 0) + 1);
    return mappa;
  }, [items]);

  const visibili = useMemo(() => {
    const cercato = normalizza(testo.trim());
    return items.filter((item) => {
      if (stato !== null && item.status !== stato) return false;
      if (cercato === '') return true;
      // Titolo, marca e categoria insieme: chi cerca «guess» non sa se
      // l'abbiamo messo nel titolo o nella marca, e non deve saperlo.
      const dove = normalizza([item.title, item.brand, item.category].filter(Boolean).join(' '));
      return dove.includes(cercato);
    });
  }, [items, testo, stato]);

  const presenti = ORDINE.filter((voce) => (conteggi.get(voce) ?? 0) > 0);

  return (
    <div className="mt-6">
      <input
        type="search"
        value={testo}
        onChange={(event) => setTesto(event.target.value)}
        placeholder="Cerca fra i tuoi oggetti"
        aria-label="Cerca fra i tuoi oggetti"
        className="w-full rounded-block border-2 border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-accent"
      />

      {/* Le linguette esistono solo se c'e' piu' di un gruppo: una fila di
          filtri sopra una lista tutta dello stesso stato non filtra niente. */}
      {presenti.length > 1 ? (
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Linguetta attiva={stato === null} onClick={() => setStato(null)}>
            Tutti {items.length}
          </Linguetta>
          {presenti.map((voce) => (
            <Linguetta key={voce} attiva={stato === voce} onClick={() => setStato(voce)}>
              {ITEM_STATUS_LABELS[voce]} {conteggi.get(voce)}
            </Linguetta>
          ))}
        </div>
      ) : null}

      {visibili.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Nessun oggetto con questi filtri.{' '}
          <button
            type="button"
            onClick={() => {
              setTesto('');
              setStato(null);
            }}
            className="underline decoration-line underline-offset-4"
          >
            Togli i filtri
          </button>
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">{visibili.map((item) => item.scheda)}</ul>
      )}
    </div>
  );
}

function Linguetta({
  attiva,
  onClick,
  children,
}: {
  attiva: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attiva}
      className={`shrink-0 rounded-[0.5rem] border-2 border-line px-3 py-1.5 text-sm font-semibold transition ${
        attiva ? 'bg-foreground text-background' : 'bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  );
}
