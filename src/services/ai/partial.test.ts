import { describe, expect, it } from 'vitest';

import { readPartialIdentification, samePartial, worthShowing, NOTHING_YET } from './partial';

describe('leggere un’identificazione mentre arriva', () => {
  it('non inventa niente da un JSON appena cominciato', () => {
    expect(readPartialIdentification('')).toEqual(NOTHING_YET);
    expect(readPartialIdentification('{')).toEqual(NOTHING_YET);
    expect(readPartialIdentification('{"na')).toEqual(NOTHING_YET);
  });

  it('non mostra una parola a meta’', () => {
    // E' la ragione per cui il valore deve essere gia' chiuso: un nome che si
    // completa sotto gli occhi sfarfalla, e sfarfallare e' peggio del vuoto.
    const meta = '{"name": "Macchina da scri';
    expect(readPartialIdentification(meta).name).toBeNull();
  });

  it('legge i campi appena sono chiusi, uno alla volta', () => {
    const primo = '{"name": "Macchina da scrivere Olivetti Valentine", "objectT';
    expect(readPartialIdentification(primo).name).toBe('Macchina da scrivere Olivetti Valentine');
    expect(readPartialIdentification(primo).objectType).toBeNull();

    const poi =
      '{"name": "Macchina da scrivere Olivetti Valentine", "objectType": "macchina da scrivere", "category": "design", "brand": "Olivetti", "model": "Valent';
    const letto = readPartialIdentification(poi);
    expect(letto.objectType).toBe('macchina da scrivere');
    expect(letto.brand).toBe('Olivetti');
    expect(letto.model).toBeNull();
  });

  it('«non identificabile» e’ una risposta, non un campo mancante', () => {
    const json = '{"name": "Vaso", "brand": null, "model": null, "period"';
    const letto = readPartialIdentification(json);
    expect(letto.name).toBe('Vaso');
    expect(letto.brand).toBeNull();
    expect(letto.model).toBeNull();
  });

  it('regge gli apici e gli accenti scappati', () => {
    const json = '{"name": "Lampada \\"Tolomeo\\" anni \\u201990", "brand": "Artemide"}';
    const letto = readPartialIdentification(json);
    expect(letto.name).toBe('Lampada "Tolomeo" anni ’90');
    expect(letto.brand).toBe('Artemide');
  });

  it('non si fa ingannare da una chiave che somiglia a un’altra', () => {
    // `objectType` contiene la parola `name`? No, ma `model` e `modelYear` si'
    // somigliano abbastanza da meritare il controllo.
    const json = '{"modelYear": "1971", "model": "Valentine"}';
    expect(readPartialIdentification(json).model).toBe('Valentine');
  });

  it('dice quando due letture sono la stessa cosa', () => {
    const uno = readPartialIdentification('{"name": "Vaso"}');
    const due = readPartialIdentification('{"name": "Vaso", "category');
    expect(samePartial(uno, due)).toBe(true);

    const tre = readPartialIdentification('{"name": "Vaso", "category": "ceramica"}');
    expect(samePartial(uno, tre)).toBe(false);
  });

  it('dice quando c’e’ abbastanza da mostrare', () => {
    expect(worthShowing(NOTHING_YET)).toBe(false);
    expect(worthShowing(readPartialIdentification('{"category": "ceramica"}'))).toBe(false);
    expect(worthShowing(readPartialIdentification('{"name": "Vaso"}'))).toBe(true);
  });
});
