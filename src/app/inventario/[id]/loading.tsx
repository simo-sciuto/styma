import { LoadingShell, Skeleton, SkeletonText } from '@/components/Skeleton';

/**
 * Un oggetto salvato mentre arriva.
 *
 * La forma e' quella della pagina vera: foto grande, identita', cartellino
 * del prezzo, e sotto il blocco «com'e' andata». Chi tocca una scheda
 * dell'inventario sa gia' dove guardera' — e sa che l'app ha registrato il
 * tocco, che era il problema vero.
 */
export default function Loading() {
  return (
    <LoadingShell label="Carico l’oggetto">
      <Skeleton className="h-3 w-24" />

      <Skeleton className="mt-5 aspect-4/3 w-full rounded-block" />

      <div className="mt-6 rounded-block border border-line bg-surface p-5 sm:p-6">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-2 h-7 w-3/4" />
            <Skeleton className="mt-2 h-3.5 w-1/2" />
          </div>
        </div>
      </div>

      {/* Il blocco della decisione: campo prezzo, verdetto, le due cifre. */}
      <div className="mt-4 rounded-block border border-line bg-surface p-5 sm:p-6">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
        <Skeleton className="mt-4 h-16 w-full rounded-block" />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
          </div>
          <div>
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
        </div>
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
      </div>

      <div className="mt-4 rounded-block border border-line bg-surface p-5 sm:p-6">
        <Skeleton className="h-2.5 w-32" />
        <SkeletonText className="mt-3" lines={3} />
      </div>
    </LoadingShell>
  );
}
