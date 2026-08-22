import Link from 'next/link';

const STEPS = [
  {
    title: 'Fotografa',
    body: 'Da 4 a 8 scatti: fronte, retro, sotto, marchio, difetti. Bastano anche meno se l’oggetto e’ evidente.',
  },
  {
    title: 'Identifica',
    body: 'Riconosciamo l’oggetto, leggiamo punzoni ed etichette, ricostruiamo epoca e materiali.',
  },
  {
    title: 'Decidi',
    body: 'Cerchiamo vendite reali, calcoliamo la forbice di prezzo e diciamo fino a quanto conviene pagarlo.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-16 pt-14 sm:pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">STYMA</p>

      <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
        Scopri quanto vale
        <br />
        quella cosa strana.
      </h1>

      <p className="mt-5 max-w-lg text-lg text-muted">
        Sei davanti a un banco, hai l’oggetto in mano e trenta secondi per decidere. Fotografalo:
        ti diciamo cos’e’, quanto vale davvero e fino a che prezzo conviene comprarlo.
      </p>

      <Link
        href="/analizza"
        className="mt-9 inline-flex items-center justify-center rounded-xl bg-foreground px-6 py-4 text-base font-medium text-background transition hover:opacity-90"
      >
        Analizza un oggetto
      </Link>

      <div className="mt-4 flex gap-3 text-sm">
        <Link
          href="/inventario"
          className="rounded-lg border border-line px-3 py-2 text-muted transition hover:border-accent hover:text-foreground"
        >
          Inventario
        </Link>
      </div>

      <ol className="mt-16 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-line bg-surface p-5">
            <span className="font-mono text-xs text-muted">0{index + 1}</span>
            <h2 className="mt-2 text-base font-semibold">{step.title}</h2>
            <p className="mt-1 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm text-muted">
        La stima nasce da vendite comparabili trovate sul mercato, non dall’intuito di un modello.
        Quando i dati non bastano, lo diciamo invece di inventare un numero.
      </p>
    </main>
  );
}
