import Link from 'next/link';

// Stesso ordine cromatico del sito di riferimento: colore piatto come ritmo,
// non come segnale. "Decidi" prende pero' il verde di --accent-vivid apposta
// — e' lo stesso colore che poi porta il prezzo e il verdetto BUY, cosi' il
// terzo passo anticipa visivamente dove porta tutto il resto della pagina.
const STEPS = [
  {
    title: 'Fotografa',
    body: 'Da 4 a 8 scatti: fronte, retro, sotto, marchio, difetti. Bastano anche meno se l’oggetto e’ evidente.',
    tone: 'bg-tile-blue text-tile-ink',
  },
  {
    title: 'Identifica',
    body: 'Riconosciamo l’oggetto, leggiamo punzoni ed etichette, ricostruiamo epoca e materiali.',
    tone: 'bg-tile-pink text-tile-ink',
  },
  {
    title: 'Decidi',
    body: 'Cerchiamo annunci reali dello stesso oggetto, calcoliamo la forbice di prezzo e diciamo fino a quanto conviene pagarlo.',
    tone: 'bg-accent-vivid text-accent-on-vivid',
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-16 pt-14 sm:pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">STYMA</p>

      <h1 className="mt-6 text-[clamp(2.75rem,2.1rem+3.2vw,5.25rem)] font-semibold leading-[0.95] tracking-tighter">
        Scopri quanto vale
        <br />
        quella cosa strana.
      </h1>

      <p className="mt-6 max-w-lg text-lg text-muted">
        Sei davanti a un banco, hai l’oggetto in mano e trenta secondi per decidere. Fotografalo:
        ti diciamo cos’e’, quanto vale davvero e fino a che prezzo conviene comprarlo.
      </p>

      <Link
        href="/analizza"
        className="mt-9 inline-flex items-center justify-center rounded-full bg-foreground px-7 py-4 text-base font-medium text-background transition hover:opacity-90"
      >
        Analizza un oggetto
      </Link>

      <div className="mt-4 flex gap-3 text-sm">
        <Link
          href="/inventario"
          className="rounded-full border border-line px-4 py-2 text-muted transition hover:border-accent hover:text-foreground"
        >
          Inventario
        </Link>
      </div>

      <ol className="mt-16 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className={`rounded-block p-6 ${step.tone}`}>
            <span className="font-mono text-xs">0{index + 1}</span>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm text-muted">
        La stima nasce da annunci comparabili trovati sul mercato, non dall’intuito di un modello.
        Sono prezzi richiesti, non vendite concluse — nessuna fonte gratuita ci dice a quanto si
        sono vendute davvero. Quando i dati non bastano, lo diciamo invece di inventare un numero.
      </p>
    </main>
  );
}
