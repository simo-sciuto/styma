'use client';

import { useState, useTransition } from 'react';

import { Card, TextButton } from '@/components/ui';
import { setArchived } from './actions';

/**
 * Toglierlo dalla lista senza buttarlo.
 *
 * Ogni analisi diventa un oggetto salvato, quindi l'inventario raccoglie
 * anche quello che hai guardato di sfuggita: senza un modo di toglierlo di
 * mezzo la lista diventerebbe inservibile proprio per chi la usa di piu'.
 *
 * Ma non c'e' nessun pulsante per cancellare, ed e' voluto. Un oggetto che
 * hai scartato e' il dato piu' difficile da raccogliere che questo prodotto
 * abbia — e' l'unico che possa dire se un «lascia stare» era giusto — e
 * cancellarlo per fare ordine vorrebbe dire buttare proprio quello.
 */
export function ArchiveToggle({ itemId, archived }: { itemId: string; archived: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setArchived(itemId, !archived);
      if (!result.ok) setError(result.error);
    });
  }

  if (archived) {
    return (
      <Card className="bg-surface-warm">
        <p className="text-sm">
          Archiviato. Non e’ in lista, ma resta nei conti.
        </p>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <TextButton className="mt-2 text-foreground" pending={pending} onClick={toggle}>
          Rimettilo in inventario
        </TextButton>
      </Card>
    );
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
      <TextButton pending={pending} onClick={toggle}>
        Toglilo dalla lista
      </TextButton>
    </div>
  );
}
