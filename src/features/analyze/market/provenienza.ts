import { formatEur } from '@/lib/format';

/**
 * Da dove arriva un'inserzione, e quanto costa farsela mandare.
 *
 * Sono due dati che eBay restituisce sempre — il paese su 100 inserzioni su
 * 100, misurato sui cinque mercati — e che finora leggeva solo il blocco delle
 * occasioni. Nella striscia dei comparabili al loro posto c'era il peso, cioe'
 * un numero che descrive il nostro conto invece dell'oggetto: chi guarda le
 * foto per capire se sono lo stesso oggetto del suo non ha niente da farci.
 *
 * Un comparabile che spedisce dal Giappone non prezza il mercato italiano
 * allo stesso modo di uno che sta a Milano, e la spedizione e' la differenza
 * fra «45 €» e «45 € piu' venti di corriere».
 */

/**
 * I nomi dei paesi che eBay restituisce come sigla. Solo quelli che compaiono
 * davvero: misurando cinque mercati su un oggetto reale sono tornati venditori
 * da nove paesi, Giappone compreso — sedici inserzioni su cento.
 */
const PAESI: Record<string, string> = {
  IT: 'Italia',
  DE: 'Germania',
  FR: 'Francia',
  GB: 'Regno Unito',
  ES: 'Spagna',
  NL: 'Paesi Bassi',
  AT: 'Austria',
  DK: 'Danimarca',
  BE: 'Belgio',
  PT: 'Portogallo',
  CH: 'Svizzera',
  PL: 'Polonia',
  JP: 'Giappone',
  US: 'Stati Uniti',
};

export function paese(code: string | null | undefined): string | null {
  if (!code) return null;
  return PAESI[code] ?? code;
}

/**
 * La spedizione, detta solo quando la sappiamo per l'Italia.
 *
 * eBay dichiara il costo verso il paese del mercato che stai interrogando:
 * su un'inserzione trovata su eBay.de quella cifra e' quanto paga un tedesco.
 * `shippingToItalyEur` si valorizza solo dal mercato italiano, dove domanda e
 * risposta coincidono; altrove resta null, e qui non si scrive niente invece
 * di scrivere un numero che parla di un altro destinatario.
 */
export function spedizione(costo: number | null | undefined): string | null {
  if (costo === null || costo === undefined) return null;
  return costo === 0 ? 'spedizione gratis' : `${formatEur(costo)} di spedizione`;
}
