import { describe, expect, it } from 'vitest';

import {
  MINIMUM_SAMPLES,
  calibrateAskingToSold,
  describeCalibration,
  type SaleObservation,
} from './calibration';

/**
 * Una vendita in cui l'oggetto era stato stimato partendo da annunci e poi
 * venduto a `salePrice`. `likelyValue` e' gia' scontato di `ratioUsed`.
 */
function sale(askingBaseline: number, salePrice: number, ratioUsed = 0.75): SaleObservation {
  return {
    likelyValue: askingBaseline * ratioUsed,
    ratioUsed,
    soldComparableCount: 0,
    salePrice,
  };
}

describe('calibrazione dello sconto sui prezzi richiesti', () => {
  it('ricava il rapporto reale fra venduto e richiesto', () => {
    // Cinque oggetti con prezzi richiesti da 100, venduti a 70.
    const calibration = calibrateAskingToSold(Array.from({ length: 5 }, () => sale(100, 70)));

    expect(calibration?.observedRatio).toBeCloseTo(0.7, 3);
    expect(calibration?.samples).toBe(5);
  });

  it('resta corretto anche su righe calcolate con uno sconto diverso', () => {
    // Il valore di configurazione puo' cambiare: senza il rapporto memorizzato
    // sulla riga, questa vendita verrebbe letta come 0,875 invece di 0,70.
    const calibration = calibrateAskingToSold([sale(200, 140, 0.6), sale(200, 140, 0.9)]);

    expect(calibration?.observedRatio).toBeCloseTo(0.7, 3);
  });

  it('ignora le stime che avevano gia’ vendite confermate sotto', () => {
    // Quelle non dicono nulla sullo sconto: il valore probabile non era un
    // prezzo richiesto scontato.
    const informative = sale(100, 70);
    const notInformative: SaleObservation = { ...sale(100, 20), soldComparableCount: 3 };

    const calibration = calibrateAskingToSold([informative, notInformative]);

    expect(calibration?.samples).toBe(1);
    expect(calibration?.observedRatio).toBeCloseTo(0.7, 3);
  });

  it('usa il mediano, cosi’ una vendita fortunata non sposta tutti', () => {
    const normali = Array.from({ length: 6 }, () => sale(100, 70));
    const colpaccio = sale(100, 900);

    const calibration = calibrateAskingToSold([...normali, colpaccio]);

    expect(calibration?.observedRatio).toBeCloseTo(0.7, 2);
  });

  it('non si considera utilizzabile finche’ il campione e’ piccolo', () => {
    const poche = calibrateAskingToSold(Array.from({ length: 5 }, () => sale(100, 70)));
    const abbastanza = calibrateAskingToSold(
      Array.from({ length: MINIMUM_SAMPLES }, () => sale(100, 70)),
    );

    expect(poche?.usable).toBe(false);
    expect(abbastanza?.usable).toBe(true);
  });

  it('misura quanto sono sparse le vendite', () => {
    const concordi = calibrateAskingToSold(Array.from({ length: 8 }, () => sale(100, 70)));
    const sparse = calibrateAskingToSold([
      ...Array.from({ length: 4 }, () => sale(100, 40)),
      ...Array.from({ length: 4 }, () => sale(100, 95)),
    ]);

    expect(concordi?.spread).toBeCloseTo(0, 3);
    expect(sparse?.spread ?? 0).toBeGreaterThan(0.4);
  });

  it('senza vendite utilizzabili non inventa un numero', () => {
    expect(calibrateAskingToSold([])).toBeNull();
    expect(calibrateAskingToSold([{ ...sale(100, 70), soldComparableCount: 2 }])).toBeNull();
    expect(calibrateAskingToSold([sale(0, 70)])).toBeNull();
  });
});

describe('cosa si dice a chi vende', () => {
  it('con poche vendite dice quante ne mancano, senza promettere', () => {
    const calibration = calibrateAskingToSold(Array.from({ length: 4 }, () => sale(100, 70)))!;
    const message = describeCalibration(calibration, 0.75);

    expect(message).toContain('4 vendite');
    expect(message).toContain('70%');
    expect(message).toContain(String(MINIMUM_SAMPLES));
  });

  it('con abbastanza vendite dichiara che ora si usa il numero suo', () => {
    const calibration = calibrateAskingToSold(
      Array.from({ length: MINIMUM_SAMPLES }, () => sale(100, 68)),
    )!;
    const message = describeCalibration(calibration, 0.75);

    expect(message).toContain('68%');
    expect(message).toContain('75%');
    expect(message).toMatch(/usano il tuo numero/);
  });
});
