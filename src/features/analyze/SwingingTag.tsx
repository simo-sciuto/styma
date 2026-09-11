/**
 * Un cartellino appeso che dondola.
 *
 * Al suo posto c'erano dei consigli che scorrevano, e sono durati un'ora: erano
 * frasi fatte, il tono da chi ti da' del tu senza conoscerti. Un'attesa non ha
 * bisogno di essere riempita di parole, ha bisogno di far vedere che qualcosa
 * si muove.
 *
 * Il cartellino e' l'immagine da cui e' nato tutto il resto — quello che un
 * rigattiere lega a un oggetto — e dondolare e' l'unica cosa che un cartellino
 * appeso sa fare. Una rotazione sola, il perno dove il filo si attacca,
 * nessuna promessa su quanto manca.
 */
export function SwingingTag() {
  return (
    <div className="mt-5 flex justify-center" aria-hidden>
      <svg
        width="64"
        height="82"
        viewBox="0 0 56 72"
        fill="none"
        className="cartellino-oscilla text-tile-teal"
      >
        {/* Il filo: resta dritto, e' il cartellino a muoversi sotto. */}
        <path d="M28 2 L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M18 14 H48 a4 4 0 0 1 4 4 v46 a4 4 0 0 1 -4 4 H12 a4 4 0 0 1 -4 -4 V24 Z"
          className="fill-surface stroke-line"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="22" r="3" className="fill-background stroke-line" strokeWidth="2.5" />
        {/* Le due righe di un prezzo che non c'e' ancora. */}
        <path
          d="M18 40 H42 M18 50 H34"
          className="stroke-line"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.25"
        />
      </svg>
    </div>
  );
}
