import { PageHeader } from '@/components/ui';
import { LoadingShell, Skeleton } from '@/components/Skeleton';

/**
 * L'andamento mentre arriva.
 *
 * Come l'inventario, questa pagina e' `force-dynamic`: legge il magazzino a
 * ogni richiesta. Senza uno scheletro, fra il tocco e la pagina non
 * succederebbe niente, e su un telefono l'app sembrerebbe piantata.
 */
export default function Loading() {
  return (
    <LoadingShell label="Conto quanto hai guadagnato">
      <PageHeader
        title="Come sta andando"
        subtitle="Quanto hai speso e quanto hai incassato."
        tone="terracotta"
      />

      {/* La forma del blocco della risposta: una cifra grande e due sotto. */}
      <div className="mt-6 rounded-block border-[3px] border-line bg-surface p-5 shadow-pop sm:p-6">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="mt-2 h-9 w-40" />
        <div className="mt-5 grid grid-cols-2 gap-4 border-t-2 border-line pt-5">
          <div>
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2 h-7 w-24" />
          </div>
          <div>
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-2 h-7 w-24" />
          </div>
        </div>
      </div>

      {/* E quella del grafico: le barre non si fingono, si lascia il loro spazio. */}
      <div className="mt-4 rounded-block border-2 border-line bg-surface p-5 sm:p-6">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 h-40 w-full sm:h-52" />
      </div>
    </LoadingShell>
  );
}
