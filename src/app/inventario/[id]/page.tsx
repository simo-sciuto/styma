import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, Disclosure, Pill } from '@/components/ui';
import { Reveal } from '@/components/Reveal';
import {
  CONDITION_LABELS,
  DEMAND_LABELS,
  LIQUIDITY_LABELS,
  MATCH_LABELS,
  RECOMMENDATION_STYLES_ON_VIVID,
  formatDate,
  formatEur,
  formatRange,
} from '@/lib/format';
import { getItemDetail } from '@/services/inventory/repository';
import {
  ITEM_STATUS_LABELS,
  describeSavedComparableTier,
  describeSavedMarketSource,
} from '@/services/inventory/types';
import { Authenticity } from '@/features/analyze/identity/Authenticity';
import { describeOutcome } from '@/services/inventory/outcome';
import { GenerateListing } from '@/features/listing/GenerateListing';
import { OutcomeTracker } from '@/features/inventory/OutcomeTracker';

export const dynamic = 'force-dynamic';

export default async function ItemPage({ params }: PageProps<'/inventario/[id]'>) {
  const { id } = await params;
  const result = await getItemDetail(id);

  // Un database irraggiungibile non e' un oggetto che non esiste: un 404 qui
  // direbbe "l'hai perso", quando invece e' solo Supabase che al momento non
  // risponde. `not_found` e `not_configured` restano 404, perche' in
  // entrambi i casi non c'e' niente da mostrare in questa pagina.
  if (result.status === 'unreachable') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
        <Link href="/inventario" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ← Inventario
        </Link>
        <Card className="mt-6 border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">
            Non riusciamo a raggiungere questo oggetto in questo momento. E’ ancora al sicuro:
            riprova fra poco.
          </p>
        </Card>
      </main>
    );
  }
  if (result.status !== 'ok') notFound();

  const { item, valuation, comparables, imageUrls } = result.detail;
  const used = comparables.filter((comparable) => comparable.used);
  const discarded = comparables.filter((comparable) => !comparable.used);

  const [cover, ...restImages] = imageUrls;
  const reasoning = valuation?.reasoning;
  const factors = reasoning?.factors ?? [];
  const reasons = reasoning?.reasons ?? [];
  const warnings = reasoning?.warnings ?? [];
  const thresholds = reasoning?.thresholds;
  const hasMarketReading =
    (reasoning?.demand && reasoning.demand !== 'unknown') ||
    (reasoning?.liquidity && reasoning.liquidity !== 'unknown');
  const hasJudgement =
    factors.length > 0 || reasons.length > 0 || warnings.length > 0 || Boolean(thresholds);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <Link href="/inventario" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ← Inventario
      </Link>

      {/* La foto grande prima di tutto: e' l'oggetto, ed e' cio' che si
          riconosce prima di leggere qualsiasi parola. Le altre restano a
          fianco, piccole, invece di stare tutte in fila alte 128px. */}
      {cover ? (
        <div className="mt-5 overflow-hidden rounded-block border border-line bg-surface-warm">
          <Image
            src={cover}
            alt=""
            width={800}
            height={600}
            unoptimized
            className="aspect-4/3 w-full object-cover"
          />
        </div>
      ) : null}

      {restImages.length > 0 ? (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {restImages.map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={200}
              height={200}
              unoptimized
              className="h-20 w-20 shrink-0 rounded-2xl border border-line object-cover sm:h-24 sm:w-24"
            />
          ))}
        </div>
      ) : null}

      {/* Il terracotta resta il segno dell'identificazione — lo stesso
          colore del tile "Identifica" in home — ma come pallino, non come
          campo pieno: a tutta larghezza era una parete arancione sopra ogni
          scheda. L'unico blocco a colore pieno qui e' il prezzo. */}
      <Card className="mt-5">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-tile-terracotta" aria-hidden />
          Identificato
        </p>
        <h1 className="mt-2 text-[clamp(1.6rem,1.35rem+1.4vw,2.25rem)] font-semibold leading-[0.95] tracking-tight text-balance">
          {item.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {[item.category, item.brand, item.model, item.estimated_period].filter(Boolean).join(' · ')}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill>{ITEM_STATUS_LABELS[item.status]}</Pill>
          {item.condition ? <Pill>{CONDITION_LABELS[item.condition] ?? item.condition}</Pill> : null}
          {item.identification_confidence !== null ? (
            <Pill>Identificazione {Math.round(item.identification_confidence * 100)}%</Pill>
          ) : null}
        </div>
      </Card>

      <div className="mt-4 space-y-4">
        {valuation && valuation.low_value !== null && valuation.high_value !== null ? (
          // Stesso cartellino della pagina di analisi: e' lo stesso numero,
          // deve leggersi identico ovunque compaia.
          <Reveal className="price-tag rounded-block bg-accent-vivid p-5 text-accent-on-vivid sm:p-6">
            <p className="text-sm font-medium">
              Valutazione del {formatDate(valuation.created_at) ?? '—'}
            </p>
            <p className="mt-1 text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-semibold leading-none tracking-tight">
              {formatRange(valuation.low_value, valuation.high_value)}
            </p>
            {valuation.likely_value !== null ? (
              <p className="mt-2 text-sm">
                Piu’ probabile {formatEur(valuation.likely_value)}
                {valuation.confidence ? ` · confidenza ${valuation.confidence}` : ''}
              </p>
            ) : null}
            {valuation.recommendation ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span>All’epoca, a {formatEur(valuation.assessed_at_price ?? 0)}:</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${RECOMMENDATION_STYLES_ON_VIVID[valuation.recommendation].tone}`}
                >
                  {RECOMMENDATION_STYLES_ON_VIVID[valuation.recommendation].label}
                </span>
                {valuation.flip_score !== null ? (
                  <span className="text-xs">{valuation.flip_score}/100</span>
                ) : null}
              </p>
            ) : null}
            {describeSavedMarketSource(valuation) ? (
              <p className="mt-3 text-xs">{describeSavedMarketSource(valuation)}</p>
            ) : null}
            {describeSavedComparableTier(valuation.comparable_tier) ? (
              <p className="mt-1 text-xs">{describeSavedComparableTier(valuation.comparable_tier)}</p>
            ) : null}
          </Reveal>
        ) : (
          <Card className="border-warn/40 bg-warn-soft">
            <p className="text-sm">
              {valuation?.reasoning?.unavailableReason ??
                'Nessuna valutazione di mercato registrata per questo oggetto.'}
            </p>
          </Card>
        )}

        {/*
          Subito sotto la stima, perche' e' la ragione per cui si riapre un
          oggetto salvato: non per rileggere il numero, ma per dire com'e'
          finita. Ed e' l'unico punto del prodotto in cui i dati arrivano dal
          mondo invece che da noi.
        */}
        <OutcomeTracker item={item} outcome={describeOutcome(item, valuation)} />

        {/* Quello che reggeva l'attribuzione il giorno dell'analisi. Senza,
            un dubbio registrato allora diventerebbe col tempo un fatto solo
            perche' nessuno lo ripete. */}
        <Authenticity authenticity={item.authenticity} />

        {/*
          Il giudizio, spiegato con quello che era gia' salvato e non veniva
          mostrato: le soglie di prezzo, come e' nata la stima, la lettura
          del mercato, le avvertenze. Prima restava un elenco di piu' e meno
          senza un numero accanto.
        */}
        {hasJudgement ? (
          <Reveal>
            <Card>
              <h2 className="text-lg font-semibold tracking-tight">Perche’ quel giudizio</h2>

              {thresholds ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-accent-soft p-3 sm:p-4">
                    <p className="text-xs font-medium text-accent">Affare fino a</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-accent sm:text-3xl">
                      {thresholds.buyUpTo !== null ? formatEur(thresholds.buyUpTo) : '—'}
                    </p>
                    {thresholds.buyUpTo === null ? (
                      <p className="mt-1 text-xs text-accent">
                        Nessun prezzo lo rendeva un affare sicuro: la stima era troppo incerta.
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-warn-soft p-3 sm:p-4">
                    <p className="text-xs font-medium text-warn">Ci potevi pensare fino a</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-warn sm:text-3xl">
                      {thresholds.maybeUpTo !== null ? formatEur(thresholds.maybeUpTo) : '—'}
                    </p>
                    {thresholds.maybeUpTo === null ? (
                      <p className="mt-1 text-xs text-warn">
                        Nessun prezzo copriva i costi di rivendita.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {factors.length > 0 ? (
                <ul className="mt-5 space-y-2.5">
                  {factors.map((factor) => (
                    <li key={factor.label} className="flex items-start gap-2.5 text-sm">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          factor.direction === 'positive'
                            ? 'bg-accent-soft text-accent'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        {factor.direction === 'positive' ? '+' : '−'}
                      </span>
                      <span className="leading-snug">{factor.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {reasons.length > 0 ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
                    Come e’ nata la stima
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {reasons.map((reason) => (
                      <li key={reason}>— {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {hasMarketReading ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
                    Lettura del mercato
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Domanda {DEMAND_LABELS[reasoning?.demand ?? 'unknown'] ?? 'non determinata'} ·{' '}
                    {LIQUIDITY_LABELS[reasoning?.liquidity ?? 'unknown'] ?? 'non determinata'}
                  </p>
                </div>
              ) : null}

              {warnings.length > 0 ? (
                <div className="mt-5 rounded-2xl bg-warn-soft p-4">
                  <p className="text-xs font-medium text-warn">Da tenere presente</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {warnings.map((warning) => (
                      <li key={warning}>— {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </Reveal>
        ) : null}

        {item.description ? (
          <Disclosure summary="Cos’e’, in breve">
            <p className="leading-relaxed">{item.description}</p>
          </Disclosure>
        ) : null}

        {used.length > 0 ? (
          <Disclosure summary={`Comparabili usati (${used.length})`}>
            <ul className="space-y-3">
              {used.map((comparable) => (
                <li key={comparable.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <a
                      href={comparable.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="min-w-0 flex-1 text-sm underline decoration-line underline-offset-4"
                    >
                      {comparable.title}
                    </a>
                    <span className="shrink-0 font-mono text-sm">
                      {formatEur(comparable.price)} {comparable.currency}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Pill tone={comparable.kind === 'sold' ? 'accent' : 'neutral'}>
                      {comparable.kind === 'sold' ? 'Venduto' : 'Richiesto'}
                    </Pill>
                    {comparable.match_level ? (
                      <Pill>{MATCH_LABELS[comparable.match_level] ?? comparable.match_level}</Pill>
                    ) : null}
                    <Pill>{comparable.source}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}

        {discarded.length > 0 ? (
          <Disclosure summary={`Comparabili scartati (${discarded.length})`}>
            <ul className="space-y-2 text-muted">
              {discarded.map((comparable) => (
                <li key={comparable.id}>
                  <span className="text-foreground">{comparable.title}</span> —{' '}
                  {comparable.discard_reason}
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}

        <GenerateListing itemId={item.id} />
      </div>
    </main>
  );
}
