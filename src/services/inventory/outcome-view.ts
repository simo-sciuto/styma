import { formatEur } from '@/lib/format';
import type { Outcome } from './outcome';

/**
 * Cosa scrive la scatola dell'esito, in quattro righe sempre uguali.
 *
 * Gli stati sono quattro e prima erano quattro schede diverse: titolo,
 * impaginazione e bottoni cambiavano a ogni passaggio, e chi riapriva un
 * oggetto doveva ricapire da capo cosa stava guardando. La forma e' sempre
 * questa:
 *
 *   stato     a che punto e' l'oggetto, in una parola
 *   frase     cos'e' successo, con dentro le date e i prezzi
 *   figure    quanto e' uscito e quanto rientra — zero o due, mai una
 *   dettagli  cio' che e' vero e minore, in fondo e in piccolo
 *
 * Sta qui e non nel componente perche' e' tutta aritmetica e parole: non
 * tocca lo stato del browser, non chiama niente, e si prova con una tabella
 * di casi invece che con un browser.
 */
export type OutcomeFigure = {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
};

export type OutcomeView = {
  stato: string;
  frase: string;
  /** Zero (non c'e' ancora niente da contare) o due (quanto esce, quanto rientra). */
  figure: OutcomeFigure[];
  dettagli: string | null;
  /** Il confronto con la nostra stima: c'e' solo a vendita fatta. */
  stima: { testo: string; centrata: boolean } | null;
};

/**
 * Attacca una subordinata solo se c'e', e mette il punto.
 *
 * Le frasi nascono da due pezzi di cui uno puo' mancare, e la versione prima
 * di questa li concatenava a mano: fra un punto e la maiuscola dopo si perdeva
 * lo spazio, e in un caso su quattro la riga usciva attaccata. Il pezzo che
 * puo' mancare e' sempre il secondo, e da li' non ha bisogno di maiuscole.
 */
function periodo(principale: string, subordinata: string | null): string {
  return subordinata === null ? `${principale}.` : `${principale}, ${subordinata}.`;
}

/** Giorni, al singolare quando e' uno solo. */
function giorni(quanti: number): string {
  return quanti === 1 ? '1 giorno' : `${quanti} giorni`;
}

/**
 * La riga minore: quanto hai strappato trattando, quanto ci hai speso sopra.
 *
 * Erano due caselle in fila con «pagato» e «guadagno», e quattro numeri della
 * stessa misura si leggono come quattro numeri della stessa importanza. Non lo
 * sono: uno dice se stai guadagnando, gli altri due sono il come.
 */
function dettagliDi(
  negotiated: number | null,
  extraCosts: number | null,
  note: string | null,
): string | null {
  const pezzi: string[] = [];
  if (negotiated !== null && negotiated > 0) {
    pezzi.push(`${formatEur(negotiated)} strappati trattando`);
  }
  if (extraCosts !== null && extraCosts > 0) {
    pezzi.push(`${formatEur(extraCosts)} di spese${note ? ` (${note})` : ''}`);
  }
  if (pezzi.length === 0) return null;

  const riga = pezzi.join(', ');
  return `${riga.charAt(0).toUpperCase()}${riga.slice(1)}.`;
}

/** Una cifra col segno davanti, verde se sopra lo zero. */
function saldo(label: string, value: number): OutcomeFigure {
  return {
    label,
    value: `${value >= 0 ? '+' : ''}${formatEur(value)}`,
    tone: value > 0 ? 'good' : 'bad',
  };
}

export function viewOutcome(outcome: Outcome, askingPrice: number | null): OutcomeView {
  if (outcome.kind === 'open') {
    return {
      stato: 'Da decidere',
      frase:
        askingPrice === null
          ? 'L’hai comprato?'
          : `${formatEur(askingPrice)}: l’hai comprato?`,
      figure: [],
      dettagli: null,
      stima: null,
    };
  }

  if (outcome.kind === 'passed') {
    return {
      stato: 'Lasciato li’',
      frase:
        outcome.askingPrice === null
          ? 'Non l’hai preso.'
          : `Ne chiedevano ${formatEur(outcome.askingPrice)} e non l’hai preso.`,
      figure: [],
      dettagli: null,
      stima: null,
    };
  }

  // Quanto l'oggetto ti e' costato davvero: il prezzo piu' quello che ci hai
  // speso sopra. La pulizia e i ricambi escono dalla stessa tasca, e tenerli
  // fuori fa sembrare ogni guadagno piu' grande di quello che e'.
  const costo =
    outcome.purchasePrice === null ? null : outcome.purchasePrice + (outcome.extraCosts ?? 0);
  const dettagli = dettagliDi(outcome.negotiated, outcome.extraCosts, outcome.extraCostsNote);

  if (outcome.kind === 'holding') {
    const quanti = outcome.listed ? outcome.daysOnMarket : outcome.daysHeld;
    const da =
      quanti === null ? null : `${outcome.listed ? 'in vendita da' : 'ce l’hai da'} ${giorni(quanti)}`;

    // La sola cifra della scatola che guarda avanti: al valore atteso della
    // stima, quanto ti resta in mano. E' la domanda di chi ha l'oggetto sullo
    // scaffale, e le altre righe dicono tutte cos'e' gia' successo.
    const resa =
      costo === null || outcome.likelyValue === null ? null : outcome.likelyValue - costo;

    return {
      stato: outcome.listed ? 'In vendita' : 'In magazzino',
      frase: periodo(costo === null ? 'L’hai comprato' : `Ti e’ costato ${formatEur(costo)}`, da),
      figure:
        costo === null
          ? []
          : [
              { label: 'Ti e’ costato', value: formatEur(costo) },
              ...(resa === null
                ? []
                : [saldo(`Venduto a ${formatEur(outcome.likelyValue ?? 0)}`, resa)]),
            ],
      dettagli,
      stima: null,
    };
  }

  const quanti = outcome.daysOnMarket ?? outcome.daysHeld;
  const dove = outcome.marketplace ? ` su ${outcome.marketplace}` : '';

  return {
    stato: 'Venduto',
    frase: periodo(
      `L’hai venduto a ${formatEur(outcome.salePrice)}${dove}`,
      quanti === null ? null : `dopo ${giorni(quanti)}`,
    ),
    figure:
      costo === null
        ? []
        : [
            { label: 'Ti e’ costato', value: formatEur(costo) },
            ...(outcome.grossMargin === null
              ? []
              : [saldo('Ci hai guadagnato', outcome.grossMargin)]),
          ],
    dettagli,
    // Il momento in cui il prodotto puo' essere smentito. Se la fascia era
    // sbagliata si dice qui, con lo stesso rilievo di quando e' giusta.
    stima:
      outcome.vsEstimate === null
        ? null
        : {
            centrata: outcome.vsEstimate.verdict === 'inside',
            testo:
              outcome.vsEstimate.verdict === 'inside'
                ? `La stima diceva ${formatEur(outcome.vsEstimate.low)}–${formatEur(outcome.vsEstimate.high)}: ci siamo.`
                : outcome.vsEstimate.verdict === 'above'
                  ? `L’avevamo sottovalutato: la stima si fermava a ${formatEur(outcome.vsEstimate.high)}.`
                  : `L’avevamo sopravvalutato: la stima partiva da ${formatEur(outcome.vsEstimate.low)}.`,
          },
  };
}
