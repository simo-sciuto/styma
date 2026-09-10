import type { Identification } from '@/schemas/identification';

/**
 * Un tetto aritmetico su quello che il modello puo' dichiarare sull'attribuzione.
 *
 * Il campo `authenticity` chiede al modello di elencare cosa sostiene
 * l'attribuzione, e una richiesta del genere spinge a trovare qualcosa: in un
 * test reale sono comparsi "finiture in ottone appropriate all'epoca" e una
 * tastiera italiana su una macchina con tastiera francese, entrambi scritti
 * con la stessa sicurezza del marchio letto davvero. Il prompt lo vieta, ma
 * un divieto e' una speranza, non una garanzia.
 *
 * Questa e' la garanzia: `strong` vuol dire "elementi verificabili", e se
 * nelle foto non si e' letto nemmeno un marchio non c'e' niente da
 * verificare — qualunque cosa il modello abbia scritto sotto. Resta
 * `consistent`, che e' esattamente cio' che si puo' dire guardando una forma:
 * torna, e non prova niente.
 *
 * Non tocca supports, concerns e toVerify: quelli restano parola del modello,
 * e la loro onesta' e' affidata al prompt. Qui si limita solo la misura, che
 * e' l'unica cosa che l'interfaccia mostra come un dato.
 */
export function groundAuthenticity(identification: Identification): Identification {
  const { authenticity, markings } = identification;
  if (!authenticity || authenticity.level !== 'strong' || markings.length > 0) {
    return identification;
  }

  return {
    ...identification,
    authenticity: { ...authenticity, level: 'consistent' },
  };
}
