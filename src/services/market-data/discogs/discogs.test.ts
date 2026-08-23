import { describe, expect, it } from 'vitest';

import type { Identification } from '@/schemas/identification';
import { describeRelease, looksLikeMusic, type DiscogsRelease } from './index';

function identification(overrides: Partial<Identification> = {}): Identification {
  return {
    name: 'Oggetto',
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
    imageQuality: 'good',
    marketPace: 'slow',
    missingShots: [],
    searchQueries: [],
    ...overrides,
  };
}

const release = (overrides: Partial<DiscogsRelease> = {}): DiscogsRelease => ({
  id: 249504,
  title: 'Pink Floyd - The Dark Side Of The Moon',
  year: '1973',
  label: 'Harvest',
  catno: 'SHVL 804',
  url: 'https://www.discogs.com/release/249504',
  numForSale: 116,
  lowestPrice: { value: 12.5, currency: 'EUR' },
  ...overrides,
});

describe('quando Discogs e’ il catalogo giusto', () => {
  it('riconosce dischi e supporti musicali', () => {
    expect(looksLikeMusic(identification({ category: 'dischi in vinile' }))).toBe(true);
    expect(looksLikeMusic(identification({ category: 'musica', name: 'LP anni 70' }))).toBe(true);
    expect(looksLikeMusic(identification({ name: 'Musicassetta originale' }))).toBe(true);
    expect(looksLikeMusic(identification({ category: 'audio', name: 'CD album' }))).toBe(true);
  });

  it('non ci prova su tutto il resto', () => {
    expect(looksLikeMusic(identification({ category: 'illuminazione' }))).toBe(false);
    expect(looksLikeMusic(identification({ category: 'fotografia', name: 'Canon AE-1' }))).toBe(false);
    // "record" come parola inglese non deve pescare "recorder" o "registratore"
    expect(looksLikeMusic(identification({ name: 'Tape recorder Sony' }))).toBe(false);
  });
});

describe('cosa si dice a chi rivende', () => {
  it('riporta etichetta, catalogo e anno', () => {
    expect(describeRelease(release())[0]).toContain('Harvest · SHVL 804 · 1973');
  });

  it('chiama concorrenza cio’ che e’ concorrenza, non domanda', () => {
    // 116 copie in vendita non significano che il disco sia richiesto:
    // significano che chi lo compra ha 116 alternative.
    const molte = describeRelease(release({ numForSale: 116 })).join(' ');
    const poche = describeRelease(release({ numForSale: 2 })).join(' ');

    expect(molte).toContain('molta concorrenza');
    expect(poche).toContain('pochissime copie');
    expect(molte).not.toMatch(/domanda/i);
  });

  it('presenta il prezzo minimo come un pavimento, non come una stima', () => {
    const notes = describeRelease(release()).join(' ');
    expect(notes).toContain('12.5 EUR');
    expect(notes).toContain('piu’ economica'.replace('’', "'"));
  });

  it('non inventa righe quando i dati mancano', () => {
    const notes = describeRelease(
      release({ numForSale: null, lowestPrice: null, label: null, catno: null, year: null }),
    );
    expect(notes.every((note) => note.length > 0)).toBe(true);
    expect(notes.join(' ')).not.toContain('null');
  });
});
