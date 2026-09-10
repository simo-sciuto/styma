import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Reveal } from '@/components/Reveal';
import { PriceZones } from '@/features/analyze/decision/PriceZones';
import { RECOMMENDATION_STYLES, formatEur, formatRange } from '@/lib/format';
import type { Identification } from '@/schemas/identification';
import { priceThresholds, recommendationAt } from '@/services/valuation/flip-score';

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
    body: 'Cerchiamo annunci reali dello stesso oggetto, calcoliamo la fascia di prezzo e diciamo fino a quanto conviene pagarlo.',
    tone: 'bg-accent-vivid text-accent-on-vivid',
    icon: TagIcon,
  },
] as const;

/**
 * L'esempio non e' scritto a mano: lo calcola il motore.
 *
 * Qui c'era un blocco di numeri sul funzionamento — quanti mercati eBay,
 * quanto costa un'analisi, quanti livelli di comparabili — cioe' fatti da
 * manuale d'officina, che a chi arriva non dicono niente di cosa ottiene. Uno
 * dei tre era anche diventato falso da solo: 0,006 € era il costo con
 * l'identificazione su Haiku, e da mesi giriamo su Sonnet a piu' del doppio.
 *
 * Un numero sulla home che invecchia senza che nessuno se ne accorga e' il
 * modo piu' silenzioso di mentire. Quelli qui sotto passano da
 * `priceThresholds` e `recommendationAt`, le stesse funzioni che rispondono
 * davanti al banco: se un giorno cambiamo l'aritmetica, l'esempio cambia con
 * lei invece di restare indietro.
 */
const ESEMPIO_OGGETTO: Identification = {
  name: 'Vaso in ceramica',
  objectType: 'vaso',
  category: 'ceramica',
  brand: null,
  model: null,
  period: 'anni 70',
  materials: ['ceramica'],
  characteristics: [],
  markings: [],
  condition: 'good',
  conditionNotes: [],
  history: '',
  confidence: 0.9,
  confidenceReasons: [],
  authenticity: null,
  marketPace: 'slow',
  imageQuality: 'good',
  missingShots: [],
  physicalChecks: [],
  searchQueries: [],
};

const ESEMPIO_FASCIA = { low: 55, high: 70, likely: 62 };

const ESEMPIO_SOGLIE = priceThresholds(
  {
    available: true,
    currency: 'EUR',
    ...ESEMPIO_FASCIA,
    confidence: 'high',
    confidenceScore: 0.85,
    used: [],
    discarded: [],
    strongCount: 6,
    identicalCount: 6,
    comparableTier: 'identical',
    dispersion: 0.2,
    reasons: [],
  },
  ESEMPIO_OGGETTO,
);

/** Quanto te lo chiedono, nell'esempio. */
const ESEMPIO_RICHIESTO = 18;
const ESEMPIO_VERDETTO = recommendationAt(ESEMPIO_RICHIESTO, ESEMPIO_SOGLIE);

export default function HomePage() {
  return (
    <>
      {/*
        A tutta larghezza e a tutta altezza, come l'hero del sito di
        riferimento (min-height:100svh, sfondo pieno, testo centrato) —
        non piu' tutto incassato in una colonna stretta su sfondo neutro.
        Il teal e' il colore "marchio" di STYMA (nav, pulsanti, logo): il
        verde di --accent-vivid resta riservato al prezzo e al verdetto,
        non diventa anche lo sfondo della prima cosa che si vede.
      */}
      <section className="relative flex min-h-[76svh] flex-col items-center justify-center overflow-hidden bg-tile-teal px-5 py-14 text-center text-tile-cream sm:min-h-[88svh] sm:py-20">
        <h1 className="reveal max-w-3xl text-balance text-[clamp(2.75rem,2.1rem+5.5vw,6.75rem)] font-semibold leading-[0.92] tracking-tighter">
          Quanto vale,
          <br />
          davvero.
        </h1>

        <p className="reveal reveal-delay-1 mt-5 max-w-xl text-2xl font-medium leading-snug tracking-tight sm:text-3xl">
          Prima di comprare, non dopo.
        </p>

        <p className="reveal reveal-delay-2 mt-6 max-w-md text-base leading-relaxed">
          Fotografa quello che hai in mano: in pochi secondi sai cos’e’, quanto vale e se conviene.
        </p>

        <div className="reveal reveal-delay-3 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/analizza"
            className="inline-flex items-center justify-center rounded-full bg-tile-cream px-7 py-4 text-base font-medium text-tile-ink transition hover:opacity-90"
          >
            Fotografa un oggetto
          </Link>
          <Link
            href="/inventario"
            className="rounded-full border border-tile-cream/50 px-4 py-2 text-sm transition hover:border-tile-cream hover:bg-black/10"
          >
            Inventario
          </Link>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-5">
        {/*
          La risposta, com'e' fatta davvero: stessi blocchi, stessi colori,
          stessa barra della pagina che vedrai. Un esempio disegnato a parte
          avrebbe promesso una cosa e consegnato un'altra.
        */}
        <Reveal className="rounded-block border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              Cosa vedi alla fine
            </p>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              esempio
            </p>
          </div>

          <p className="mt-4 text-lg">
            Un vaso al mercatino. Costa{' '}
            <strong className="font-semibold">{formatEur(ESEMPIO_RICHIESTO)}</strong>.
          </p>

          <div className="mt-3 rounded-block bg-accent-vivid px-5 py-4 text-accent-on-vivid">
            <p className="text-[clamp(1.75rem,1.5rem+1.4vw,2.5rem)] font-semibold leading-none tracking-tight">
              {RECOMMENDATION_STYLES[ESEMPIO_VERDETTO].label}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Lo rivendi a
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight">
                {formatRange(ESEMPIO_FASCIA.low, ESEMPIO_FASCIA.high)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Paga fino a
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight">
                {ESEMPIO_SOGLIE.buyUpTo !== null ? formatEur(ESEMPIO_SOGLIE.buyUpTo) : '—'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <PriceZones thresholds={ESEMPIO_SOGLIE} askingPrice={ESEMPIO_RICHIESTO} />
          </div>

          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            Il prezzo massimo e’ una sottrazione che puoi rifare a mente: quanto lo rivendi, meno
            commissioni, spedizione e quello che teniamo da parte perche’ la stima puo’ sbagliare.
            Nell’analisi trovi il conto, riga per riga.
          </p>
        </Reveal>

        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              delay={index * 90}
              className={`rounded-block p-5 sm:p-6 ${step.tone}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10">
                  <step.icon />
                </span>
                <span className="font-mono text-xs">0{index + 1}</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed">{step.body}</p>
            </Reveal>
          ))}
        </ol>

        <p className="mt-10 text-sm text-muted">
          La stima nasce da annunci comparabili trovati sul mercato, non dall’intuito di un modello.
          Sono prezzi richiesti, non vendite concluse: le vendite vere nessuno le vende a condizioni
          che possiamo accettare, e fingere di stimarle sarebbe la bugia piu’ comoda. Quando i dati
          non bastano, te lo diciamo invece di riempire il vuoto con un numero.
        </p>
      </main>

      <Footer />
    </>
  );
}
