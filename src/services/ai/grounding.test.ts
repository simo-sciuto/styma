import { describe, expect, it } from 'vitest';

import { anIdentification } from '@/schemas/testing';
import { groundAuthenticity } from './grounding';

const forte = {
  level: 'strong' as const,
  supports: ['le proporzioni corrispondono'],
  concerns: [],
  toVerify: [],
};

describe('tetto sull’attribuzione', () => {
  it('senza un marchio letto, «elementi verificabili» diventa «coerente»', () => {
    // Non c'e' niente da verificare: e' aritmetica, non un giudizio sul
    // modello. Quello che resta e' cio' che si puo' davvero dire guardando
    // una forma — torna, e non prova niente.
    const grounded = groundAuthenticity(
      anIdentification({ markings: [], authenticity: forte }),
    );
    expect(grounded.authenticity?.level).toBe('consistent');
  });

  it('con un marchio letto il livello resta quello dichiarato', () => {
    const grounded = groundAuthenticity(
      anIdentification({ markings: ['Olivetti'], authenticity: forte }),
    );
    expect(grounded.authenticity?.level).toBe('strong');
  });

  it('non tocca i livelli piu’ bassi: sono gia’ dichiarazioni di poca evidenza', () => {
    const debole = { ...forte, level: 'weak' as const };
    const grounded = groundAuthenticity(anIdentification({ markings: [], authenticity: debole }));
    expect(grounded.authenticity?.level).toBe('weak');
  });

  it('non tocca supports, concerns e toVerify', () => {
    // Il tetto limita la misura, che l'interfaccia mostra come un dato.
    // Il testo resta parola del modello: riscriverlo sarebbe inventare.
    const grounded = groundAuthenticity(
      anIdentification({
        markings: [],
        authenticity: { ...forte, concerns: ['manca il marchio'], toVerify: ['guarda sotto'] },
      }),
    );
    expect(grounded.authenticity?.supports).toEqual(forte.supports);
    expect(grounded.authenticity?.concerns).toEqual(['manca il marchio']);
    expect(grounded.authenticity?.toVerify).toEqual(['guarda sotto']);
  });

  it('un oggetto senza attribuzione da verificare passa intatto', () => {
    const anonimo = anIdentification({ authenticity: null });
    expect(groundAuthenticity(anonimo)).toBe(anonimo);
  });
});
