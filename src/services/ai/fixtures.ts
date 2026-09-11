import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { IdentificationSchema, type Identification } from '@/schemas/identification';
import { groundAuthenticity } from './grounding';
import { MarketResearchSchema } from '@/schemas/market';
import { ListingCopySchema } from '@/schemas/listing';
import { aiConfig } from './config';
import {
  ProviderError,
  type IdentificationOutcome,
  type ImageInput,
  type ListingFacts,
  type ListingOutcome,
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

const listingKey = (facts: ListingFacts) =>
  digest([
    facts.name,
    facts.brand ?? '',
    facts.model ?? '',
    facts.condition ?? '',
    facts.conditionNotes.join('|'),
  ]);

type FixtureKind = 'identify' | 'research' | 'listing';

function fixturePath(kind: FixtureKind, key: string): string {
  return path.join(FIXTURE_DIR, `${kind}-${key}.json`);
}

function readFixture(kind: FixtureKind, key: string): unknown | null {
  const file = fixturePath(kind, key);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeFixture(kind: FixtureKind, key: string, value: unknown): void {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(fixturePath(kind, key), `${JSON.stringify(value, null, 2)}\n`);
}

function missingFixtureError(kind: FixtureKind, key: string, label: string): ProviderError {
  return new ProviderError(
    `Nessuna registrazione per ${label}. L'app sta rigiocando risposte salvate: riavvia senza STYMA_AI_FIXTURES per chiamare il modello davvero, oppure con STYMA_AI_RECORD=1 per registrare (file atteso: ${kind}-${key}.json).`,
    'fixture_missing',
  );
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
  /*
   * I parziali non si rigiocano. Una registrazione e' gia' completa quando
   * viene letta, e spezzettarla con dei timer per far sembrare che il modello
   * stia scrivendo sarebbe la cosa piu' vicina a una bugia che questo
   * componente sa fare: mostrerebbe un'attesa inventata al posto di una vera.
   * Chi rigioca un fixture riceve l'identificazione tutta insieme, che e'
   * esattamente quello che e' successo.
   */
  async identify(images: ImageInput[]): Promise<IdentificationOutcome> {
    const key = identifyKey(images);
    const raw = readFixture('identify', key);
    if (raw === null) throw missingFixtureError('identify', key, 'queste foto');

    const parsed = IdentificationSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProviderError(
        `La registrazione identify-${key}.json non corrisponde piu' allo schema.`,
        'invalid_response',
        { cause: parsed.error },
      );
    }

    return { identification: groundAuthenticity(parsed.data), usage: { ...NO_USAGE } };
  }

  async researchMarket(
    identification: Identification,
    options?: ResearchOptions,
  ): Promise<MarketResearchOutcome> {
    const key = researchKey(identification);
    const raw = readFixture('research', key);
    if (raw === null) {
      throw missingFixtureError('research', key, `il mercato di "${identification.name}"`);
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

  async generateListing(facts: ListingFacts): Promise<ListingOutcome> {
    const key = listingKey(facts);
    const raw = readFixture('listing', key);
    if (raw === null) throw missingFixtureError('listing', key, `l'annuncio di "${facts.name}"`);

    const parsed = ListingCopySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProviderError(
        `La registrazione listing-${key}.json non corrisponde piu' allo schema.`,
        'invalid_response',
        { cause: parsed.error },
      );
    }

    return { listing: parsed.data, usage: { ...NO_USAGE } };
  }
}

/**
 * Passa le chiamate al provider vero e salva cio' che torna. Si paga una volta
 * per non pagare mai piu' la stessa prova.
 */
export class RecordingProvider implements ObjectIntelligenceProvider {
  constructor(private readonly inner: ObjectIntelligenceProvider) {}

  async identify(
    images: ImageInput[],
    options: Parameters<ObjectIntelligenceProvider['identify']>[1] = {},
  ): Promise<IdentificationOutcome> {
    const outcome = await this.inner.identify(images, options);
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

  async generateListing(facts: ListingFacts): Promise<ListingOutcome> {
    const outcome = await this.inner.generateListing(facts);
    const key = listingKey(facts);
    writeFixture('listing', key, outcome.listing);
    console.info(`[fixtures] registrato listing-${key}.json`);
    return outcome;
  }
}
