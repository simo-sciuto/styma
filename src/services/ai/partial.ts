/**
 * Cosa si riesce gia' a dire mentre il modello sta ancora scrivendo.
 *
 * L'identificazione misurata dura **21 secondi su una foto sola**, e non e'
 * la ricerca a costare: eBay risponde in due secondi e mezzo su cinque
 * mercati. Sono millecinquecento token di prosa, generati uno dopo l'altro,
 * mentre chi ha fatto la foto guarda uno schermo fermo con il venditore che
 * aspetta.
 *
 * Ma i campi che contano escono per primi. Lo schema comincia con `name`,
 * `objectType`, `category`, `brand`, `model`: sono i primi duecento caratteri
 * del JSON, cioe' due o tre secondi. Tutto il resto — la storia, i controlli
 * da fare, i motivi della confidenza — serve alla pagina del risultato, non
 * a chi sta aspettando di sapere cos'ha in mano.
 *
 * Questa funzione legge quei campi da un JSON ancora aperto. Non e' un parser
 * tollerante e non prova a esserlo: cerca una chiave alla volta e accetta solo
 * un valore gia' chiuso dalle virgolette. Un nome letto a meta' che si
 * completa un istante dopo farebbe sfarfallare la parola sotto gli occhi, che
 * e' peggio del vuoto.
 */
export type PartialIdentification = {
  name: string | null;
  objectType: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
};

export const NOTHING_YET: PartialIdentification = {
  name: null,
  objectType: null,
  category: null,
  brand: null,
  model: null,
};

/**
 * Il valore di una chiave stringa, solo se la stringa e' gia' chiusa.
 *
 * `null` letterale conta come risposta: sono campi nullable, e «marca: non
 * identificabile» e' un'informazione tanto quanto un nome.
 */
function readField(json: string, key: string): string | null | undefined {
  const nullo = new RegExp(`"${key}"\\s*:\\s*null`).exec(json);
  if (nullo) return null;

  // La stringa deve essere chiusa da virgolette non scappate: finche' il
  // modello sta scrivendo dentro il valore, questa non trova niente.
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(json);
  if (!match) return undefined;

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return undefined;
  }
}

export function readPartialIdentification(json: string): PartialIdentification {
  const leggi = (key: keyof PartialIdentification) => {
    const value = readField(json, key);
    return value === undefined ? null : value;
  };

  return {
    name: leggi('name'),
    objectType: leggi('objectType'),
    category: leggi('category'),
    brand: leggi('brand'),
    model: leggi('model'),
  };
}

/** Se due letture parziali dicono la stessa cosa: evita di ri-mandare eventi uguali. */
export function samePartial(a: PartialIdentification, b: PartialIdentification): boolean {
  return (
    a.name === b.name &&
    a.objectType === b.objectType &&
    a.category === b.category &&
    a.brand === b.brand &&
    a.model === b.model
  );
}

/** Se c'e' gia' abbastanza da mostrare qualcosa a chi aspetta. */
export function worthShowing(partial: PartialIdentification): boolean {
  return partial.name !== null || partial.brand !== null || partial.model !== null;
}
