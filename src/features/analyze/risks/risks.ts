import type { AnalysisResult } from '@/schemas/analysis';

export type RiskSeverity = 'high' | 'medium';

export type Risk = {
  id: string;
  severity: RiskSeverity;
  /** Cosa non torna, in una riga. */
  label: string;
  /** Perche' conta per chi sta decidendo, o cosa puo' farci. */
  detail: string;
};


/** Sotto questi il campione non e' un campione. */
const TINY_SAMPLE = 2;

/**
 * I rischi che valgono la pena di essere letti sono quelli che cambiano da
 * oggetto a oggetto.
 *
 * Il fatto che i prezzi siano richiesti e non venduti e' vero sempre, per
 * costruzione, ed e' gia' dichiarato nella sezione mercato: ripeterlo qui lo
 * trasformerebbe in rumore, e insegnerebbe a saltare l'elenco proprio quando
 * contiene qualcosa di specifico. Un avviso che c'e' sempre non e' un avviso.
 */
export function collectRisks(result: AnalysisResult): Risk[] {
  const { identification, valuation, warnings } = result;
  const risks: Risk[] = [];

  const add = (id: string, severity: RiskSeverity, label: string, detail: string) => {
    risks.push({ id, severity, label, detail });
  };

  // — Quanto e' solido cio' che pensiamo che sia
  if (identification.confidence < 0.5) {
    add(
      'identity-weak',
      'high',
      'Non siamo sicuri di cosa sia',
      `Identificazione al ${Math.round(identification.confidence * 100)}%: la stima poggia su un'attribuzione che potrebbe essere sbagliata in partenza.`,
    );
  } else if (identification.confidence < 0.75) {
    add(
      'identity-partial',
      'medium',
      'Identificazione non certa',
      `Al ${Math.round(identification.confidence * 100)}%: probabile, non confermata. Un marchio leggibile la sposterebbe.`,
    );
  }

  // Un dubbio sull'attribuzione non e' un dubbio come gli altri: se il pezzo
  // non e' quello che sembra, i comparabili sono di un altro oggetto e la
  // fascia intera non c'entra niente. Sale al livello grave anche quando
  // tutto il resto e' solido.
  const concerns = identification.authenticity?.concerns ?? [];
  if (concerns.length > 0) {
    add(
      'authenticity-concerns',
      'high',
      concerns.length === 1
        ? 'C’e’ un elemento che non torna sull’attribuzione'
        : `Ci sono ${concerns.length} elementi che non tornano sull’attribuzione`,
      'Se non e’ il pezzo che sembra, i comparabili sono di un altro oggetto e la stima non vale. Guarda cosa non torna prima di trattare.',
    );
  }

  if (identification.imageQuality === 'poor') {
    add(
      'photos-poor',
      'high',
      'Le foto non bastano',
      'Poco leggibili: quello che non si vede non e’ stato valutato, ne’ in bene ne’ in male.',
    );
  } else if (identification.imageQuality === 'mixed') {
    add(
      'photos-mixed',
      'medium',
      'Qualche foto e’ poco leggibile',
      'Parte dei dettagli e’ interpretata piu’ che letta.',
    );
  }

  // — Quanto e' solido il numero
  if (valuation.available) {
    if (valuation.comparableTier === 'weak') {
      add(
        'comparables-weak',
        'high',
        'Nessun comparabile davvero vicino',
        'La stima esce da annunci della stessa categoria, non dello stesso oggetto: e’ un ordine di grandezza, non un prezzo.',
      );
    } else if (valuation.comparableTier === 'similar') {
      add(
        'comparables-similar',
        'medium',
        'Nessun annuncio dello stesso identico modello',
        'Entrano oggetti simili della stessa marca o famiglia: somigliano, ma non e’ detto valgano uguale.',
      );
    }

    if (valuation.confidence === 'low') {
      add(
        'value-low-confidence',
        'high',
        'Stima poco affidabile',
        'Trattala come un punto di partenza per trattare, non come un prezzo su cui contare.',
      );
    }

    if (valuation.used.length <= TINY_SAMPLE) {
      add(
        'sample-tiny',
        'medium',
        `Solo ${valuation.used.length} ${valuation.used.length === 1 ? 'annuncio' : 'annunci'} nel campione`,
        'Con cosi’ pochi dati un singolo venditore fuori mercato sposta tutta la stima.',
      );
    }

    if (valuation.dispersion > 0.6) {
      add(
        'prices-scattered',
        'medium',
        'I prezzi trovati sono molto diversi fra loro',
        'Il mercato non ha un prezzo condiviso per questo oggetto: la fascia e’ larga perche’ lo e’ la realta’.',
      );
    }

  }

  // — Quanto e' solido l'oggetto
  if (identification.condition === 'poor') {
    add(
      'condition-poor',
      'high',
      'Stato di conservazione scarso',
      'I comparabili in stato migliore valgono di piu’: la stima ne tiene conto, il compratore anche.',
    );
  } else if (identification.condition === 'fair') {
    add(
      'condition-fair',
      'medium',
      'Stato di conservazione discreto',
      'Vendibile, ma i difetti vanno dichiarati nell’annuncio e pesano sul prezzo.',
    );
  }

  // Nessun difetto trovato non vuol dire nessun difetto: vuol dire che nelle
  // foto ricevute non se ne vedevano.
  if (identification.conditionNotes.length === 0 && identification.missingShots.length > 0) {
    add(
      'condition-unseen',
      'medium',
      'Non tutto l’oggetto e’ stato fotografato',
      'Non abbiamo rilevato difetti, ma non abbiamo nemmeno visto tutto: controlla di persona le parti che mancano.',
    );
  }

  // — Quello che la pipeline ha gia' segnalato per conto suo
  for (const warning of warnings) {
    add(`pipeline-${warning.slice(0, 24)}`, 'medium', warning, '');
  }

  // Prima i rischi gravi: chi legge in fretta legge le prime due righe.
  const order: Record<RiskSeverity, number> = { high: 0, medium: 1 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity]);
}
