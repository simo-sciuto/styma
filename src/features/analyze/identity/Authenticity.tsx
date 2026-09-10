'use client';

import { Card } from '@/components/ui';
import { AUTHENTICITY_METER, AUTHENTICITY_LABELS } from '@/lib/format';
import type { Authenticity as AuthenticityData } from '@/schemas/identification';

/**
 * Quanto le prove visibili sostengono l'attribuzione — e nient'altro.
 *
 * Non c'e' nessuna riga di questa sezione che dica se il pezzo e' vero. Da
 * una fotografia non si stabilisce l'autenticita' di niente, e un prodotto
 * che si pronunciasse comunque farebbe il danno peggiore che sa fare: dare a
 * chi sta per pagare una sicurezza che nessuno gli ha guadagnato. Quello che
 * si puo' dire e' cosa si vede, cosa non torna e cosa guardare meglio.
 *
 * Per questo la misura e' una barra a quattro tacche e non una percentuale:
 * una percentuale sull'autenticita' si legge come una probabilita' di essere
 * originale, che e' esattamente il numero che non abbiamo.
 */
export function Authenticity({ authenticity }: { authenticity: AuthenticityData | null }) {
  // Un oggetto anonimo non puo' essere ne' vero ne' falso: la sezione non
  // esiste, invece di esistere vuota e insegnare a saltarla.
  if (!authenticity) return null;

  const { level, supports, concerns, toVerify } = authenticity;
  const filled = AUTHENTICITY_METER[level];
  const hasConcerns = concerns.length > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Quanto e’ sicuro che sia questo
        </p>
        <p className={`text-sm font-medium ${hasConcerns ? 'text-warn' : ''}`}>
          {AUTHENTICITY_LABELS[level]}
        </p>
      </div>

      <div className="mt-2 flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-1.5 flex-1 rounded-full ${
              step < filled ? (hasConcerns ? 'bg-warn' : 'bg-accent') : 'bg-line'
            }`}
          />
        ))}
      </div>

      {/* Cosa non torna sta in cima: e' l'unica parte che puo' cambiare la
          decisione di chi sta per pagare. */}
      {hasConcerns ? (
        <div className="mt-4 rounded-2xl bg-warn-soft p-4">
          <p className="text-xs font-medium text-warn">Cosa non torna</p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {concerns.map((concern) => (
              <li key={concern} className="leading-snug">
                — {concern}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {supports.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Cosa la sostiene
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {supports.map((support) => (
              <li key={support} className="leading-snug">
                — {support}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {toVerify.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Cosa guardare per esserne piu’ sicuro
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {toVerify.map((check) => (
              <li key={check} className="leading-snug">
                — {check}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        Nessuna di queste righe dice che il pezzo e’ autentico, e nemmeno che non lo e’: da una
        fotografia non si stabilisce. Dice quanta evidenza si vede — e dove cercarne altra.
      </p>
    </Card>
  );
}
