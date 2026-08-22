import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { IdentificationSchema, type Identification } from '@/schemas/identification';
import { MarketResearchSchema } from '@/schemas/market';
import { aiConfig } from './config';
import {
  ProviderError,
  type IdentificationOutcome,
  type ImageInput,
  type MarketResearchOutcome,
  type ObjectIntelligenceProvider,
  type ResearchOptions,
} from './provider';

const FIXTURE_DIR = path.join(process.cwd(), 'bench', 'fixtures');

const NO_USAGE = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  thinkingTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  webSearches: 0,
  webFetches: 0,
  usd: 0,
};

/** Chiave stabile: le stesse foto, o lo stesso oggetto, danno lo stesso file. */
function digest(parts: string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex').slice(0, 16);
}

const identifyKey = (images: ImageInput[]) => digest(images.map((image) => image.data));

const researchKey = (identification: Identification) =>
  digest([
    (identification.brand ?? '').toLowerCase().trim(),
    (identification.model ?? '').toLowerCase().trim(),
    identification.name.toLowerCase().trim(),
  ]);

function fixturePath(kind: 'identify' | 'research', key: string): string {
  return path.join(FIXTURE_DIR, `${kind}-${key}.json`);
}

function readFixture(kind: 'identify' | 'research', key: string): unknown | null {
  const file = fixturePath(kind, key);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeFixture(kind: 'identify' | 'research', key: string, value: unknown): void {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(fixturePath(kind, key), `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Rigioca risposte registrate invece di chiamare il modello.
 *
 * Esiste perche' iterare sull'interfaccia costava soldi veri a ogni ricarica
 * della pagina: una registrazione pagata una volta rende gratis tutte le prove
 * successive. Le risposte ripassano comunque dagli schemi Zod, cosi' un
 * fixture invecchiato fallisce invece di far finta di andare bene.
 */
export class FixtureProvider implements ObjectIntelligenceProvider {
  async identify(images: ImageInput[]): Promise<IdentificationOutcome> {
    const key = identifyKey(images);
    const raw = readFixture('identify', key);
    if (raw === null) {
      throw new ProviderError(
        `Nessuna registrazione per queste foto (identify-${key}.json). Rilancia con STYMA_AI_RECORD=1 per crearne una.`,
        'unavailable',
      );
    }

    const parsed = IdentificationSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProviderError(
        `La registrazione identify-${key}.json non corrisponde piu' allo schema.`,
        'invalid_response',
        { cause: parsed.error },
      );
    }

    return { identification: parsed.data, usage: { ...NO_USAGE } };
  }

  async researchMarket(
    identification: Identification,
    options?: ResearchOptions,
  ): Promise<MarketResearchOutcome> {
    const key = researchKey(identification);
    const raw = readFixture('research', key);
    if (raw === null) {
      throw new ProviderError(
        `Nessuna registrazione di mercato per "${identification.name}" (research-${key}.json). Rilancia con STYMA_AI_RECORD=1.`,
        'unavailable',
      );
    }

    const parsed = MarketResearchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProviderError(
        `La registrazione research-${key}.json non corrisponde piu' allo schema.`,
        'invalid_response',
        { cause: parsed.error },
      );
    }

    // Le corsie non girano davvero, ma l'interfaccia deve poter essere provata
    // come la vedra' l'utente: si annunciano finite tutte insieme.
    for (const lane of aiConfig.research.lanes) {
      options?.onLaneSettled?.({
        id: lane.id,
        label: lane.label,
        status: 'done',
        comparables: 0,
      });
    }

    return { research: parsed.data, warnings: [], usage: { ...NO_USAGE } };
  }
}

/**
 * Passa le chiamate al provider vero e salva cio' che torna. Si paga una volta
 * per non pagare mai piu' la stessa prova.
 */
export class RecordingProvider implements ObjectIntelligenceProvider {
  constructor(private readonly inner: ObjectIntelligenceProvider) {}

  async identify(images: ImageInput[]): Promise<IdentificationOutcome> {
    const outcome = await this.inner.identify(images);
    const key = identifyKey(images);
    writeFixture('identify', key, outcome.identification);
    console.info(`[fixtures] registrato identify-${key}.json`);
    return outcome;
  }

  async researchMarket(
    identification: Identification,
    options?: ResearchOptions,
  ): Promise<MarketResearchOutcome> {
    const outcome = await this.inner.researchMarket(identification, options);
    const key = researchKey(identification);
    writeFixture('research', key, outcome.research);
    console.info(`[fixtures] registrato research-${key}.json`);
    return outcome;
  }
}
