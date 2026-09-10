import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod/v4';

import { IdentificationSchema } from '@/schemas/identification';
import { ListingCopySchema } from '@/schemas/listing';
import { MarketResearchSchema } from '@/schemas/market';

/**
 * Le risposte registrate devono restare valide contro gli schemi che le
 * rileggono.
 *
 * Non e' teoria: cambiando lo schema di identificazione e poi quello degli
 * annunci le ho rotte due volte, e il guasto si vede solo quando qualcuno
 * prova a sviluppare con STYMA_AI_FIXTURES=1 — cioe' tardi, e addosso a chi
 * non ha toccato lo schema. Qui si vede subito.
 */
const FIXTURES_DIR = join(process.cwd(), 'bench', 'fixtures');

const SCHEMAS: { prefix: string; schema: ZodType }[] = [
  { prefix: 'identify-', schema: IdentificationSchema },
  { prefix: 'research-', schema: MarketResearchSchema },
  { prefix: 'listing-', schema: ListingCopySchema },
];

describe('risposte registrate in bench/fixtures', () => {
  const files = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith('.json'));

  it('ce n’e’ almeno una, altrimenti questo test non sta verificando niente', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s e’ valida contro il suo schema', (name) => {
    const match = SCHEMAS.find((candidate) => name.startsWith(candidate.prefix));
    // Un prefisso sconosciuto e' un file che nessuno rilegge piu': meglio
    // saperlo che lasciarlo marcire nella cartella.
    expect(match, `nessuno schema per il prefisso di ${name}`).toBeDefined();

    const raw: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
    const parsed = match!.schema.safeParse(raw);

    expect(
      parsed.success ? null : JSON.stringify(parsed.error.issues, null, 2),
    ).toBeNull();
  });
});
