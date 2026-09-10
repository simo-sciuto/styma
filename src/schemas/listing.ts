import * as z from 'zod/v4';

export const LISTING_MARKETPLACES = ['vinted', 'ebay', 'subito', 'wallapop'] as const;
export type ListingMarketplace = (typeof LISTING_MARKETPLACES)[number];

export const MARKETPLACE_LABELS: Record<ListingMarketplace, string> = {
  vinted: 'Vinted',
  ebay: 'eBay',
  subito: 'Subito',
  wallapop: 'Wallapop',
};

/**
 * Quanti caratteri accetta il titolo su ciascun marketplace.
 *
 * Non e' un limite che imponiamo noi allo schema: se il modello sfora di due
 * caratteri, rifiutare l'intero annuncio sarebbe una punizione sproporzionata
 * per chi sta aspettando. Lo mostriamo accanto al titolo, cosi' chi copia
 * vede subito se deve accorciare.
 */
export const TITLE_LIMITS: Record<ListingMarketplace, number> = {
  vinted: 100,
  ebay: 80,
  subito: 50,
  wallapop: 50,
};

/**
 * Cosa puo' scrivere il modello per un annuncio. Volutamente senza un campo
 * prezzo: il prezzo lo calcola `services/listing`, dalla valutazione gia'
 * salvata. Un modello che scrive testo naturale e inventa un numero nello
 * stesso respiro e' esattamente il rischio che lo schema serve a togliere.
 *
 * Il titolo cambia per marketplace, la descrizione no: il titolo e' il campo
 * su cui le piattaforme si comportano davvero in modo diverso (eBay premia le
 * parole chiave, Vinted il parlato, Subito e Wallapop hanno poco spazio),
 * mentre la descrizione sono gli stessi fatti sullo stesso oggetto ovunque —
 * chiederne quattro versioni costerebbe token per riscrivere le stesse cose.
 */
export const ListingCopySchema = z.object({
  titles: z.object({
    vinted: z
      .string()
      .max(150)
      .describe(
        'Titolo per Vinted, max 100 caratteri: marca, modello, cosa lo distingue, come lo direbbe una persona. Niente prezzo.',
      ),
    ebay: z
      .string()
      .max(150)
      .describe(
        'Titolo per eBay, max 80 caratteri: denso di parole chiave, perche' +
          ' li’ il titolo e’ il campo su cui si cerca. Marca, modello, tipo di oggetto, epoca, colore, taglia o misura se le sai.',
      ),
    subito: z
      .string()
      .max(150)
      .describe(
        'Titolo per Subito, max 50 caratteri: asciutto e concreto, da annuncio di piccoli annunci. Marca e oggetto prima di tutto.',
      ),
    wallapop: z
      .string()
      .max(150)
      .describe(
        'Titolo per Wallapop, max 50 caratteri: corto e colloquiale, marca e oggetto.',
      ),
  }),
  description: z
    .string()
    .describe(
      'Descrizione dell’annuncio, in italiano, pronta da incollare su qualsiasi marketplace. Colloquiale e concreta, come la scriverebbe chi vende davvero quell’oggetto — non un comunicato stampa. Include stato di conservazione e difetti visibili senza nasconderli: dichiararli qui costa una vendita in meno, nasconderli ne costa una recensione negativa.',
    ),
  keywords: z
    .array(z.string())
    .max(10)
    .describe('Parole chiave separate, utili alla ricerca: marca, modello, categoria, epoca, stile.'),
});

export type ListingCopy = z.infer<typeof ListingCopySchema>;
