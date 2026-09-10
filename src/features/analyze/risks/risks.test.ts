import { describe, expect, it } from 'vitest';

import type { AnalysisResult, Valuation } from '@/schemas/analysis';
import { collectRisks } from './risks';
import type { Identification } from '@/schemas/identification';
import { anIdentification } from '@/schemas/testing';

const identification = anIdentification({
  name: 'Vaso',
  objectType: 'vaso',
  category: 'ceramica',
  brand: 'Bitossi',
  model: 'Rimini Blu',
  period: 'anni 70',
  materials: ['ceramica'],
  markings: ['Bitossi'],
  conditionNotes: ['piccola sbeccatura sul bordo'],
});

const valuation: Extract<Valuation, { available: true }> = {
  available: true,
  currency: 'EUR',
  low: 60,
  likely: 70,
  high: 80,
  confidence: 'high',
  confidenceScore: 0.8,
  used: [1, 2, 3, 4, 5].map((n) => ({
    comparable: {
      title: `x${n}`,
      source: 'eBay',
      url: `https://x.test/${n}`,
      price: 70,
      currency: 'EUR' as const,
      kind: 'asking' as const,
      soldAt: null,
      condition: 'good' as const,
      matchLevel: 'exact_model' as const,
      notes: '',
    },
    priceEur: 70,
    weight: 0.9,
    weightBreakdown: { match: 1, condition: 0.9 },
  })),
  discarded: [],
  strongCount: 5,
  identicalCount: 5,
  comparableTier: 'identical',
  dispersion: 0.2,
  reasons: [],
};

function result(
  identificationOverrides: Partial<Identification> = {},
  valuationOverrides: Partial<Extract<Valuation, { available: true }>> = {},
  warnings: string[] = [],
): AnalysisResult {
  return {
    identification: { ...identification, ...identificationOverrides },
    market: null,
    marketSource: null,
    valuation: { ...valuation, ...valuationOverrides },
    flip: null,
    warnings,
  };
}

const ids = (r: AnalysisResult) => collectRisks(r).map((risk) => risk.id);

describe('rischi raccolti', () => {
  it('un caso solido non inventa preoccupazioni', () => {
    expect(collectRisks(result())).toEqual([]);
  });

  it('non ripete quello che e’ vero sempre', () => {
    // I prezzi sono richiesti e non venduti per costruzione, ed e' gia'
    // dichiarato nella sezione mercato. Un avviso che c'e' sempre non e' un
    // avviso: insegna a saltare l'elenco.
    expect(ids(result()).some((id) => id.includes('asking'))).toBe(false);
  });

  it('mette i rischi gravi per primi', () => {
    const risks = collectRisks(
      result({ confidence: 0.3, condition: 'fair' }, { dispersion: 0.9 }),
    );
    const severities = risks.map((risk) => risk.severity);
    const ultimoGrave = severities.lastIndexOf('high');
    const primoMedio = severities.indexOf('medium');

    expect(risks[0]!.severity).toBe('high');
    expect(ultimoGrave).toBeLessThan(primoMedio);
  });

  it('distingue un’identificazione incerta da una non certa', () => {
    expect(ids(result({ confidence: 0.3 }))).toContain('identity-weak');
    expect(ids(result({ confidence: 0.6 }))).toContain('identity-partial');
    expect(ids(result({ confidence: 0.9 }))).not.toContain('identity-partial');
  });

  it('segnala i comparabili deboli con la gravita’ giusta', () => {
    expect(ids(result({}, { comparableTier: 'weak' }))).toContain('comparables-weak');
    expect(ids(result({}, { comparableTier: 'similar' }))).toContain('comparables-similar');
    expect(ids(result({}, { comparableTier: 'identical' })).some((id) => id.startsWith('comparables'))).toBe(
      false,
    );
  });

  it('segnala un campione minimo', () => {
    expect(ids(result({}, { used: valuation.used.slice(0, 2) }))).toContain('sample-tiny');
    expect(ids(result({}, { used: valuation.used.slice(0, 3) }))).not.toContain('sample-tiny');
  });

  it('la spedizione non e’ piu’ un rischio, perche’ non e’ piu’ un costo', () => {
    // Il conto non toglie piu' spedizione e imballo: chi usa STYMA vende
    // soprattutto di persona, e un costo che non paghi non puo' diventare
    // un avviso. Su un oggetto da 15 €, dove prima scattava per primo, ora
    // non deve restare niente che ne parli.
    expect(ids(result({}, { likely: 15 })).some((id) => id.startsWith('shipping'))).toBe(false);
  });

  it('«nessun difetto trovato» non e’ «nessun difetto»', () => {
    const nonVisto = result({ conditionNotes: [], missingShots: ['il fondo'] });
    expect(ids(nonVisto)).toContain('condition-unseen');

    // Se abbiamo visto tutto, o se i difetti li abbiamo gia' elencati, non
    // c'e' niente da avvertire.
    expect(ids(result({ conditionNotes: [], missingShots: [] }))).not.toContain('condition-unseen');
    expect(ids(result({ conditionNotes: ['crepa'], missingShots: ['il fondo'] }))).not.toContain(
      'condition-unseen',
    );
  });

  it('un dubbio sull’attribuzione e’ un rischio grave, anche col resto solido', () => {
    // Se il pezzo non e' quello che sembra, i comparabili sono di un altro
    // oggetto: non c'e' niente di solido che tenga.
    const risks = collectRisks(
      result({
        authenticity: {
          level: 'weak',
          supports: ['la forma corrisponde'],
          concerns: ['nessun marchio dove dovrebbe esserci'],
          toVerify: ['guarda sotto la base'],
        },
      }),
    );

    expect(risks).toHaveLength(1);
    expect(risks[0].id).toBe('authenticity-concerns');
    expect(risks[0].severity).toBe('high');
  });

  it('un’attribuzione senza dubbi non produce un rischio', () => {
    // `concerns` vuoto vuol dire "non ho notato niente", non "e' autentico":
    // in nessuno dei due casi c'e' qualcosa da segnalare qui.
    const risks = collectRisks(
      result({
        authenticity: { level: 'strong', supports: ['marchio leggibile'], concerns: [], toVerify: [] },
      }),
    );
    expect(risks).toEqual([]);
  });

  it('porta dentro anche gli avvisi della pipeline', () => {
    const risks = collectRisks(result({}, {}, ['eBay non ha risposto su un mercato']));
    expect(risks.some((risk) => risk.label.includes('eBay non ha risposto'))).toBe(true);
  });

  it('senza valutazione non prova a giudicare il numero che non c’e’', () => {
    const senzaStima: AnalysisResult = {
      ...result(),
      valuation: { available: false, reason: 'niente comparabili', discarded: [], observed: null },
    };
    const risky = ids(senzaStima);
    expect(risky.some((id) => id.startsWith('comparables') || id.startsWith('shipping'))).toBe(false);
  });
});
