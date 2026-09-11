'use client';

import Link from 'next/link';

import { formatDate, formatEur } from '@/lib/format';
import type { PreviousSighting } from '@/services/inventory/repository';
import { Card } from '@/components/ui';

/**
 * «Questo l'hai gia' visto».
 *
 * Al mercato lo stesso modello ricapita, e prima l'app non se ne accorgeva:
 * rifaceva l'analisi da zero e mostrava una fascia come se fosse la prima
 * volta. Ma in quel momento l'informazione che cambia la decisione non e' la
 * stima, che sara' la stessa di tre settimane fa: e' che tre settimane fa
 * l'avevi lasciato a 40 € e adesso te ne chiedono 60.
 *
 * Sta sopra il verdetto, perche' e' l'unica cosa in pagina che parla di te e
 * non dell'oggetto, e perche' un «ci sei gia' passato» letto dopo aver deciso
 * arriva tardi.
 */
function racconta(sighting: PreviousSighting): string {
  const quando = formatDate(sighting.seenAt) ?? 'in passato';

  if (sighting.status === 'sold' && sighting.salePrice !== null) {
    const pagato = sighting.purchasePrice !== null ? `preso a ${formatEur(sighting.purchasePrice)}, ` : '';
    return `${quando}: ${pagato}venduto a ${formatEur(sighting.salePrice)}.`;
  }
  if (sighting.status === 'bought' || sighting.status === 'listed') {
    const pagato =
      sighting.purchasePrice !== null ? ` a ${formatEur(sighting.purchasePrice)}` : '';
    return `${quando}: comprato${pagato}, ce l’hai ancora.`;
  }
  if (sighting.status === 'passed') {
    const chiesto =
      sighting.askingPrice !== null ? `, ne chiedevano ${formatEur(sighting.askingPrice)}` : '';
    return `${quando}: lasciato li’${chiesto}.`;
  }
  const chiesto =
    sighting.askingPrice !== null ? `, ne chiedevano ${formatEur(sighting.askingPrice)}` : '';
  return `${quando}: analizzato e mai deciso${chiesto}.`;
}

export function PreviousSightings({ sightings }: { sightings: PreviousSighting[] }) {
  if (sightings.length === 0) return null;

  const venduto = sightings.find(
    (sighting) => sighting.status === 'sold' && sighting.salePrice !== null,
  );

  return (
    <Card className="bg-surface-warm">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
        Ci sei gia’ passato
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">
        {sightings.length === 1
          ? 'Questo modello l’hai gia’ analizzato.'
          : `Questo modello l’hai gia’ analizzato ${sightings.length} volte.`}
      </p>

      <ul className="mt-2 space-y-1 text-sm">
        {sightings.map((sighting) => (
          <li key={sighting.id}>
            <Link
              href={`/inventario/${sighting.id}`}
              className="underline decoration-line underline-offset-4"
            >
              {racconta(sighting)}
            </Link>
          </li>
        ))}
      </ul>

      {/* Una vendita vera dello stesso modello vale piu' di ogni comparabile
          di questa pagina: e' l'unico prezzo che hai incassato tu, per questo
          oggetto, sul tuo mercato. */}
      {venduto ? (
        <p className="mt-3 border-t-2 border-line pt-3 text-sm">
          Uno l’hai gia’ venduto a <strong>{formatEur(venduto.salePrice!)}</strong>: e’ l’unico
          prezzo qui dentro che hai incassato davvero.
        </p>
      ) : null}
    </Card>
  );
}
