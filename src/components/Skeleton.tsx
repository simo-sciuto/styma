/**
 * Lo scheletro di quello che sta arrivando.
 *
 * Non e' una rotella al centro dello schermo: e' la forma del contenuto —
 * la foto, il titolo, il cartellino del prezzo — in grigio tenue, con una
 * luce che passa. Chi aspetta sa gia' dove guardera', e quando i dati
 * arrivano non deve ricostruire la pagina con gli occhi.
 *
 * Serve soprattutto a `/inventario` e `/inventario/[id]`, che sono
 * `force-dynamic`: interrogano Supabase e firmano gli URL delle foto a ogni
 * richiesta, e fino a ieri fra il tocco e la pagina non succedeva niente.
 *
 * Sono componenti server: nessuno stato, nessun `use client`.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/**
 * Righe di testo finte, di larghezza decrescente: un paragrafo vero non
 * arriva mai in fondo all'ultima riga, e ripeterlo qui evita il rettangolo
 * pieno che non somiglia a niente.
 */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  const larghezze = ['w-full', 'w-11/12', 'w-8/12', 'w-10/12', 'w-7/12'];
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-3.5 ${larghezze[index % larghezze.length]}`} />
      ))}
    </div>
  );
}

/**
 * Il guscio di una pagina che sta caricando, con la frase che dice cosa
 * stiamo aspettando.
 *
 * La frase non e' decorazione: uno scheletro muto lascia chi legge a
 * chiedersi se l'app sta lavorando o si e' rotta, e la risposta cambia se
 * ha davanti un mercatino che chiude.
 */
export function LoadingShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </main>
  );
}
