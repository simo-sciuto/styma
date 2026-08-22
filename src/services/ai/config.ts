/**
 * Configurazione del provider AI. Tenuta separata dal codice di chiamata
 * per poter tarare modello, effort e budget senza toccare la logica.
 */
export const aiConfig = {
  identification: {
    model: 'claude-opus-5',
    /** low | medium | high | xhigh | max. In campo la latenza conta: partiamo da medium. */
    effort: 'medium' as const,
    maxTokens: 16000,
  },
  research: {
    model: 'claude-opus-5',
    effort: 'medium' as const,
    maxTokens: 16000,
    maxSearches: 12,
    /** Giri massimi del loop di tool use prima di arrenderci. */
    maxIterations: 12,
  },
  /** Mercato di riferimento: orienta i risultati di ricerca. */
  market: {
    country: 'IT',
    timezone: 'Europe/Rome',
  },
} as const;
