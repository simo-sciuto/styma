'use client';

import type { AnalysisResult } from '@/schemas/analysis';
import { Card } from '@/components/ui';
import { collectRisks, type RiskSeverity } from './risks';

const DOT: Record<RiskSeverity, string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
};

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  high: 'grave',
  medium: 'da sapere',
};

/**
 * Cosa puo' andare storto, in un posto solo.
 *
 * I segnali c'erano gia' tutti, sparsi: un avviso della pipeline qui, un
 * tetto di confidenza dentro i motivi della stima, uno stato di conservazione
 * fra i dettagli, la dispersione dentro i fattori del punteggio. Chi legge
 * doveva ricomporli da solo per capire quanto fidarsi — cioe' fare il lavoro
 * che questo prodotto esiste per fare.
 *
 * Un elenco vuoto e' una risposta, e si dice: nessun rischio *rilevato* non
 * e' nessun rischio, ed e' una distinzione che vale la pena scrivere.
 */
export function RiskList({ result }: { result: AnalysisResult }) {
  const risks = collectRisks(result);

  if (risks.length === 0) {
    return (
      <Card>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Cosa puo’ andare storto
        </p>
        <p className="mt-2 text-sm text-muted">
          Niente da segnalare. Resta quello che una foto non vede: controlla di persona.
        </p>
      </Card>
    );
  }

  const gravi = risks.filter((risk) => risk.severity === 'high').length;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Cosa puo’ andare storto
        </p>
        <p className="text-xs text-muted">
          {risks.length} {risks.length === 1 ? 'segnale' : 'segnali'}
          {gravi > 0 ? `, ${gravi} ${gravi === 1 ? 'grave' : 'gravi'}` : ''}
        </p>
      </div>

      <ul className="mt-3 space-y-3">
        {risks.map((risk) => (
          <li key={risk.id} className="flex gap-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[risk.severity]}`}
              title={SEVERITY_LABEL[risk.severity]}
              aria-label={SEVERITY_LABEL[risk.severity]}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{risk.label}</p>
              {risk.detail ? (
                <p className="mt-0.5 text-sm leading-snug text-muted">{risk.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
