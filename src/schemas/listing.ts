import * as z from 'zod/v4';

/**
 * Cosa puo' scrivere il modello per un annuncio. Volutamente senza un campo
 * prezzo: il prezzo lo calcola `services/listing`, dalla valutazione gia'
 * salvata. Un modello che scrive testo naturale e inventa un numero nello
 * stesso respiro e' esattamente il rischio che lo schema serve a togliere.
 */
export const ListingCopySchema = z.object({
  title: z
    .string()
    .max(100)
    .describe(
      'Titolo dell’annuncio. Vinted lo mostra corto: marca, modello, cosa lo distingue. Niente prezzo, niente punteggiatura decorativa.',
    ),
  description: z
    .string()
    .describe(
      'Descrizione dell’annuncio, in italiano, pronta da incollare. Colloquiale e concreta, come la scriverebbe chi vende davvero quell’oggetto — non un comunicato stampa. Include stato di conservazione e difetti visibili senza nasconderli: dichiararli qui costa una vendita in meno, nasconderli ne costa una recensione negativa.',
    ),
  keywords: z
    .array(z.string())
    .max(10)
    .describe('Parole chiave separate, utili alla ricerca su Vinted: marca, modello, categoria, epoca, stile.'),
});

export type ListingCopy = z.infer<typeof ListingCopySchema>;
