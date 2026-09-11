import { SOURCE_LABELS, type ListingSource } from '@/services/listings/parse';

/**
 * La strada per tornare all'annuncio da cui e' nata l'analisi.
 *
 * `ListingCard` mette a confronto quello che dice chi vende e quello che
 * vediamo noi, e quel confronto conta nel momento della decisione: vive nello
 * stato del browser e finisce li'. Quello che serve dopo e' un'altra cosa, ed
 * e' una sola: com'e' che ci torno. «Quella borsa che avevo visto e' ancora
 * in vendita? a quanto sta adesso?» e' la domanda di chi riapre l'oggetto fra
 * un mese, e prima dell'indirizzo salvato non aveva risposta.
 *
 * Due righe, non una scheda: e' un collegamento, e a un collegamento non
 * serve una cornice.
 */
export function ListingLink({
  listing,
}: {
  listing: { url: string; source: ListingSource } | null;
}) {
  if (!listing) return null;

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center justify-between gap-3 rounded-block border-2 border-line bg-surface-warm px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Da un annuncio
        </span>
        <span className="mt-0.5 block text-sm font-semibold">
          Riaprilo su {SOURCE_LABELS[listing.source]}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-lg">
        ↗
      </span>
    </a>
  );
}
