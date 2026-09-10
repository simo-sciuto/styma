'use client';

import type { Identification } from '@/schemas/identification';
import { Card } from '@/components/ui';

/**
 * Cosa fare con l'oggetto in mano, prima di tirare fuori i soldi.
 *
 * E' l'unica sezione della pagina che non parla di quello che sappiamo noi,
 * ma di quello che puo' sapere solo chi e' li'. Una fotografia non sente un
 * suono sordo, non prova un meccanismo, non pesa niente: qualunque cosa
 * dicessimo su quei fronti sarebbe un'ipotesi travestita da verifica.
 *
 * Sta in fondo alla pagina apposta — si legge quando la decisione e' gia'
 * presa e resta l'ultimo passaggio prima di pagare.
 */
export function BeforeYouBuy({ identification }: { identification: Identification }) {
  const { physicalChecks, missingShots } = identification;
  if (physicalChecks.length === 0 && missingShots.length === 0) return null;

  return (
    <Card className="border-accent/30 bg-accent-soft">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent">
        Prima di pagare
      </p>

      {physicalChecks.length > 0 ? (
        <ol className="mt-3 space-y-2.5">
          {physicalChecks.map((check, index) => (
            <li key={check} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[0.65rem] font-semibold text-accent-soft"
              >
                {index + 1}
              </span>
              <span className="leading-snug">{check}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {missingShots.length > 0 ? (
        <p className="mt-4 border-t border-accent/20 pt-3 text-xs">
          Se qualcosa non torna, rifai l’analisi con una foto di:{' '}
          <strong>{missingShots.join(', ')}</strong>.
        </p>
      ) : null}
    </Card>
  );
}
