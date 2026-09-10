import { PageHeader } from '@/components/ui';
import { LoadingShell, Skeleton } from '@/components/Skeleton';

/**
 * L'inventario mentre arriva.
 *
 * L'intestazione e' quella vera, non uno scheletro: non dipende dai dati, e
 * disegnarla in grigio significherebbe far sfarfallare una cosa che non
 * cambia. Sotto, la forma dei totali e delle prime schede.
 *
 * Next prefetcha questo file, quindi la navigazione diventa immediata: il
 * tocco produce una pagina, non trecento millisecondi di niente mentre
 * Supabase risponde e firma gli URL delle foto.
 */
export default function Loading() {
  return (
    <LoadingShell label="Carico l’inventario">
      <PageHeader
        title="Inventario"
        subtitle="Ogni oggetto che hai analizzato, con la valutazione che aveva quel giorno e com’e’ andata a finire."
      />

      {/* I quattro totali del cruscotto. */}
      <div className="mt-6 rounded-block bg-surface-warm p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index}>
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2 h-7 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Le prime schede: riga compatta sul telefono, griglia da sm in su,
          come la lista vera. */}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="min-w-0">
            <div className="flex gap-3 rounded-block border-2 border-line bg-surface p-3 sm:block sm:p-0">
              <Skeleton className="aspect-square w-24 shrink-0 rounded-xl sm:aspect-4/3 sm:w-full sm:rounded-none" />
              <div className="flex min-w-0 flex-1 flex-col justify-center sm:block sm:p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <div className="mt-3 flex gap-1.5">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
