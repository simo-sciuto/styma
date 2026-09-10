import { describe, expect, it } from 'vitest';

import type { AnalysisResult, Valuation } from '@/schemas/analysis';
import type { Identification } from '@/schemas/identification';
import { flipConfig } from '@/services/valuation/config';
import { collectRisks } from './risks';

const identification: Identification = {
  name: 'Vaso',
  objectType: 'vaso',
  category: 'ceramica',
  brand: 'Bitossi',
  model: 'Rimini Blu',
  period: 'anni 70',
  materials: ['ceramica'],
  characteristics: [],
  markings: ['Bitossi'],
  condition: 'good',
  conditionNotes: ['piccola sbeccatura sul bordo'],
  history: '',
  confidence: 0.9,
  confidenceReasons: [],
  marketPace: 'slow',
  imageQuality: 'good',
  missingShots: [],
  searchQueries: [],
};

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

  it('la spedizione diventa un rischio quando si mangia l’oggetto', () => {
    // Su un oggetto da 15 € i 9 € di spedizione sono il 60%: non e' un
    // dettaglio contabile, e' la ragione per cui l'affare non e' un affare.
    const piccolo = result({}, { likely: 15 });
    expect(ids(piccolo)).toContain('shipping-critical');

    const medio = result({}, { likely: flipConfig.defaultShippingCost / 0.35 });
    expect(ids(medio)).toContain('shipping-heavy');

    const grande = result({}, { likely: 300 });
    expect(ids(grande).some((id) => id.startsWith('shipping'))).toBe(false);
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
