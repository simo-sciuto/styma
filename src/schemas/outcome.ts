import * as z from 'zod/v4';

/**
 * Cosa e' successo davvero a un oggetto dopo l'analisi.
 *
 * Arriva da un form nel browser, quindi passa da qui prima di toccare il
 * database: un'azione server e' un endpoint pubblico come tutti gli altri,
 * anche se la si chiama come una funzione.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')
  .describe('Giorno in formato AAAA-MM-GG, come lo scrive <input type="date">');

const money = z.number().nonnegative().max(1_000_000);

/** Testo libero corto: uno spazio vuoto e' un dato assente, non una stringa vuota. */
const shortText = z
  .string()
  .trim()
  .max(80)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

export const OutcomeInputSchema = z.discriminatedUnion('type', [
  /** L'hai comprato: da qui in poi il prezzo pagato e' un fatto, non un'ipotesi. */
  z.object({
    type: z.literal('bought'),
    price: money,
    date: isoDate,
    location: shortText,
  }),
  /**
   * L'hai lasciato li'. E' la meta' del dataset che nessuno registra mai, ed
   * e' l'unica che puo' dire se un "lascia stare" era giusto.
   */
  z.object({ type: z.literal('passed') }),
  z.object({
    type: z.literal('listed'),
    date: isoDate,
    marketplace: shortText,
  }),
  z.object({
    type: z.literal('sold'),
    price: money,
    date: isoDate,
    marketplace: shortText,
  }),
  /**
   * Quello che ci hai speso sopra: pulizia, ricambi, trasporto, l'ingresso al
   * mercato. Una cifra e una nota, non una tabella di voci: chi sta chiudendo
   * una vendita scrive «35, ricambi e pulizia» in tre secondi, e un modulo a
   * righe multiple non lo compila nessuno.
   *
   * Zero e' un valore legittimo e diverso da null: «non ho speso altro» e
   * «non l'ho ancora detto» sono due cose diverse.
   */
  z.object({
    type: z.literal('costs'),
    amount: money,
    note: shortText,
  }),
  /** Sbagliato a segnare: si torna indietro invece di convivere con un dato falso. */
  z.object({ type: z.literal('reopen') }),
]);

export type OutcomeInput = z.infer<typeof OutcomeInputSchema>;
