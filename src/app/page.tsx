import Link from 'next/link';

// Stesso principio della revisione precedente, colori nuovi: un blocco
// pieno come ritmo, non come segnale. "Decidi" prende il verde di
// --accent-vivid apposta — lo stesso che porta poi il prezzo e il
// verdetto BUY, cosi' il terzo passo anticipa dove porta la pagina.
const STEPS = [
  {
    title: 'Fotografa',
    body: 'Da 4 a 8 scatti: fronte, retro, sotto, marchio, difetti. Bastano anche meno se l’oggetto e’ evidente.',
    tone: 'bg-tile-teal text-tile-cream',
  },
  {
    title: 'Identifica',
    body: 'Riconosciamo l’oggetto, leggiamo punzoni ed etichette, ricostruiamo epoca e materiali.',
    tone: 'bg-tile-terracotta text-tile-ink',
  },
  {
    title: 'Decidi',
    body: 'Cerchiamo annunci reali dello stesso oggetto, calcoliamo la forbice di prezzo e diciamo fino a quanto conviene pagarlo.',
    tone: 'bg-accent-vivid text-accent-on-vivid',
  },
] as const;

// Numeri veri, misurati altrove nel progetto (bench/, AGENTS.md) — non
// piazzati per fare colpo.
const NUMBERS = [
  { value: '5', label: 'mercati eBay interrogati a ogni ricerca' },
  { value: '€0,006', label: 'costo medio di un’analisi completa' },
  { value: '3', label: 'livelli di comparabili, dal piu’ sicuro al piu’ cauto' },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-16 pt-14 sm:pt-24">
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-tile-teal" aria-hidden />
        STYMA
      </p>

      <h1 className="mt-6 text-[clamp(2.75rem,2.1rem+3.2vw,5.25rem)] font-semibold leading-[0.95] tracking-tighter text-balance">
        Prima di pagare,
        <br />
        chiedi a noi.
      </h1>

      <p className="mt-6 max-w-lg text-lg text-muted">
        Fotografa quello che hai in mano. In pochi secondi sai cos’e’, quanto vale davvero e se
        conviene comprarlo.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link
          href="/analizza"
          className="inline-flex items-center justify-center rounded-full bg-tile-teal px-7 py-4 text-base font-medium text-tile-cream transition hover:opacity-90"
        >
          Fotografa un oggetto
        </Link>
        <Link
          href="/inventario"
          className="rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground"
        >
          Inventario
        </Link>
      </div>

      <section className="mt-14 rounded-block bg-surface-warm p-6 sm:p-8">
        <p className="text-sm font-medium text-muted">Misurato, non tirato a indovinare.</p>
        <div className="mt-5 grid grid-cols-3 gap-4">
          {NUMBERS.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-semibold tracking-tighter sm:text-4xl">{stat.value}</p>
              <p className="mt-1.5 text-xs leading-snug text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
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
