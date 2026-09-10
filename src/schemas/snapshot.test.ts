import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { IdentificationSchema } from './identification';
import { MarketResearchSchema } from './market';
import { AnalysisSnapshotSchema } from './snapshot';
import { valuate } from '@/services/valuation/valuate';

/**
 * Lo schema dello snapshot deve accettare quello che il motore produce
 * davvero.
 *
 * Il controllo sui tipi in `snapshot.ts` garantisce che i campi ci siano; non
 * garantisce che i *valori* passino. Un `confidence` che diventasse una
 * stringa nuova, un livello di comparabili in piu': il tipo lo direbbe, ma
 * solo dopo aver aggiornato entrambi i file. Qui l'analisi viene costruita
 * dalle risposte registrate e fatta passare dallo schema come se tornasse dal
 * database — che e' esattamente quello che le succedera'.
 */
const FIXTURES = join(process.cwd(), 'bench', 'fixtures');

function load(prefix: string) {
  return readdirSync(FIXTURES)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as unknown);
}

describe('l’analisi salvata rientra dallo schema', () => {
  const identifications = load('identify-').map((raw) => IdentificationSchema.parse(raw));
  const researches = load('research-').map((raw) => MarketResearchSchema.parse(raw));

  it('ci sono registrazioni su cui provare', () => {
    expect(identifications.length).toBeGreaterThan(0);
    expect(researches.length).toBeGreaterThan(0);
  });

  it('accetta ogni combinazione di identificazione e ricerca registrate', () => {
    for (const identification of identifications) {
      for (const market of researches) {
        const snapshot = {
          identification,
          market,
          marketSource: { cached: false, researchedAt: '2026-09-10T00:00:00Z', ageDays: 0 },
          valuation: valuate(identification, market),
          warnings: [],
        };

        const parsed = AnalysisSnapshotSchema.safeParse(snapshot);
        expect(
          parsed.success ? null : JSON.stringify(parsed.error.issues, null, 2),
        ).toBeNull();
      }
    }
  });

  it('accetta anche il caso in cui non c’e’ stata nessuna ricerca', () => {
    // "Non lo so" e' una risposta del prodotto, quindi e' anche uno stato che
    // deve poter essere salvato e riaperto.
    const snapshot = {
      identification: identifications[0],
      market: null,
      marketSource: null,
      valuation: valuate(identifications[0], null),
      warnings: ['nessuna fonte di mercato disponibile'],
    };

    expect(AnalysisSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('un JSON a cui manca un pezzo viene rifiutato, non accettato a meta’', () => {
    const snapshot = {
      identification: identifications[0],
      market: null,
      marketSource: null,
      valuation: valuate(identifications[0], null),
    };
    expect(AnalysisSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
});
