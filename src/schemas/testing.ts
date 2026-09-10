import type { Identification } from './identification';

/**
 * Un'identificazione completa per i test, da personalizzare con overrides.
 *
 * Esiste per una ragione precisa: `IdentificationSchema` e' cresciuto tre
 * volte (objectType, physicalChecks, authenticity) e ogni volta ha rotto
 * cinque oggetti letterali copiati in cinque file diversi — che vitest non
 * segnala, perche' non tipa: se ne accorge solo `npm run typecheck`, e solo
 * se qualcuno lo lancia. Con un costruttore solo, un campo nuovo e' una riga
 * in un posto.
 *
 * Nessun codice dell'applicazione importa questo file.
 */
export function anIdentification(overrides: Partial<Identification> = {}): Identification {
  return {
    name: 'Oggetto',
    objectType: 'oggetto',
    category: 'varie',
    brand: null,
    model: null,
    period: null,
    materials: [],
    characteristics: [],
    markings: [],
    condition: 'good',
    conditionNotes: [],
    history: '',
    confidence: 0.9,
    confidenceReasons: [],
    authenticity: null,
    marketPace: 'slow',
    imageQuality: 'good',
    missingShots: [],
    physicalChecks: [],
    searchQueries: [],
    ...overrides,
  };
}
