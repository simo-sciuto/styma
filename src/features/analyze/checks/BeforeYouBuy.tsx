'use client';

import type { Identification } from '@/schemas/identification';
import { Card } from '@/components/ui';

/**
 * Cosa fare con l'oggetto in mano, prima di tirare fuori i soldi.
 *
 * Stava in fondo alla pagina, dopo ogni prova e ogni accordion, con la
 * motivazione che «si legge quando la decisione e' gia' presa». Era il
 * ragionamento giusto applicato al posto sbagliato: la decisione e' presa
 * quattro centimetri piu' su, e questi sono i gesti dei dieci secondi
 * successivi. Ora sta subito sotto il verdetto.
 *
 * E' l'unica sezione della pagina che non parla di quello che sappiamo noi,
 * ma di quello che puo' sapere solo chi e' li'. Una fotografia non sente un
 * suono sordo, non prova un meccanismo, non pesa niente: qualunque cosa
 * dicessimo su quei fronti sarebbe un'ipotesi travestita da verifica.
 */
export function BeforeYouBuy({ identification }: { identification: Identification }) {
  const { physicalChecks, missingShots } = identification;
  if (physicalChecks.length === 0 && missingShots.length === 0) return null;

  return (
    <Card className="bg-accent-soft">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent">
        Prima di pagare
      </p>

      {physicalChecks.length > 0 ? (
        <ol className="mt-3 space-y-2.5">
          {physicalChecks.map((check, index) => (
            <li key={check} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.35rem] border-2 border-line bg-surface font-mono text-[0.7rem] font-bold"
              >
                {index + 1}
              </span>
              <span className="leading-snug">{check}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {missingShots.length > 0 ? (
        <p className="mt-4 border-t-2 border-line pt-3 text-xs">
          Se qualcosa non torna, rifai l’analisi con una foto di:{' '}
          <strong>{missingShots.join(', ')}</strong>.
        </p>
      ) : null}
    </Card>
  );
}
