/**
 * Il nome del modello, ridotto a cio' che identifica l'oggetto.
 *
 * Il modello di visione scrive quello che vede: la stessa macchina e' uscita
 * una volta come "AE-1" e una come "AE-1 con FD 50mm f/1.8". La coda e' vera
 * ma non identifica: come chiave di cache produce due voci per lo stesso
 * oggetto, e come query di ricerca fa passare da undicimila inserzioni a una.
 */
const ACCESSORY_SEPARATORS = /\s+(?:con|with|avec|mit|piu'|più|\+|e)\s+|[,(/]/i;

export function coreModel(model: string): string {
  return (model.split(ACCESSORY_SEPARATORS)[0] ?? model).trim();
}
