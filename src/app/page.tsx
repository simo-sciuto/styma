import Link from 'next/link';

// Icone lineari, disegnate a mano nel file invece che prese da una libreria:
// tre gesti veri (inquadrare, ispezionare, spuntare) non tre astrazioni.
function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
function LoupeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15 15" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5V5a2 2 0 0 1 2-2h6.5L21 11.5 12.5 20 3 11.5Z" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Stesso principio della revisione precedente, colori nuovi: un blocco
// pieno come ritmo, non come segnale. "Decidi" prende il verde di
// --accent-vivid apposta — lo stesso che porta poi il prezzo e il
// verdetto BUY, cosi' il terzo passo anticipa dove porta la pagina.
const STEPS = [
  {
    title: 'Fotografa',
    body: 'Da 4 a 8 scatti: fronte, retro, sotto, marchio, difetti. Bastano anche meno se l’oggetto e’ evidente.',
    tone: 'bg-tile-teal text-tile-cream',
    icon: CameraIcon,
  },
  {
    title: 'Identifica',
    body: 'Riconosciamo l’oggetto, leggiamo punzoni ed etichette, ricostruiamo epoca e materiali.',
    tone: 'bg-tile-terracotta text-tile-ink',
    icon: LoupeIcon,
  },
  {
    title: 'Decidi',
    body: 'Cerchiamo annunci reali dello stesso oggetto, calcoliamo la forbice di prezzo e diciamo fino a quanto conviene pagarlo.',
    tone: 'bg-accent-vivid text-accent-on-vivid',
    icon: TagIcon,
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-16 pt-8 sm:pt-14">
      <h1 className="text-[clamp(2.75rem,2.1rem+3.2vw,5.25rem)] font-semibold leading-[0.95] tracking-tighter text-balance">
        Quanto vale,
        <br />
        davvero.
      </h1>

      <p className="mt-3 text-2xl font-medium leading-tight tracking-tight text-accent sm:text-3xl">
        Prima di comprare, non dopo.
      </p>

      <p className="mt-5 max-w-lg text-lg text-muted">
        Fotografa quello che hai in mano: in pochi secondi sai cos’e’, quanto vale e se conviene.
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
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10">
                <step.icon />
              </span>
              <span className="font-mono text-xs">0{index + 1}</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h2>
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
