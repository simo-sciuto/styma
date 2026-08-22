import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, Disclosure, Pill } from '@/components/ui';
import { CONDITION_LABELS, MATCH_LABELS, formatDate, formatEur, formatRange } from '@/lib/format';
import { getItemDetail } from '@/services/inventory/repository';
import { ITEM_STATUS_LABELS } from '@/services/inventory/types';

export const dynamic = 'force-dynamic';

export default async function ItemPage({ params }: PageProps<'/inventario/[id]'>) {
  const { id } = await params;
  const detail = await getItemDetail(id);
  if (!detail) notFound();

  const { item, valuation, comparables, imageUrls } = detail;
  const used = comparables.filter((comparable) => comparable.used);
  const discarded = comparables.filter((comparable) => !comparable.used);

  const profit =
    item.sale_price !== null && item.purchase_price !== null
      ? item.sale_price - item.purchase_price
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-20 pt-8">
      <Link href="/inventario" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ← Inventario
      </Link>

      {imageUrls.length > 0 ? (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {imageUrls.map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={200}
              height={200}
              unoptimized
              className="h-32 w-32 shrink-0 rounded-xl border border-line object-cover"
            />
          ))}
        </div>
      ) : null}

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{item.title}</h1>
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

      <div className="mt-5 space-y-4">
        {valuation && valuation.low_value !== null && valuation.high_value !== null ? (
          <Card>
            <p className="text-sm text-muted">
              Valutazione del {formatDate(valuation.created_at) ?? '—'}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {formatRange(valuation.low_value, valuation.high_value)}
            </p>
            {valuation.likely_value !== null ? (
              <p className="mt-1 text-sm text-muted">
                Piu’ probabile {formatEur(valuation.likely_value)}
                {valuation.confidence ? ` · confidenza ${valuation.confidence}` : ''}
              </p>
            ) : null}
            {valuation.recommendation ? (
              <p className="mt-3 text-sm">
                All’epoca, a {formatEur(valuation.assessed_at_price ?? 0)}:{' '}
                <strong>{valuation.recommendation}</strong>
                {valuation.flip_score !== null ? ` (${valuation.flip_score}/100)` : ''}
              </p>
            ) : null}
          </Card>
        ) : (
          <Card className="border-warn/40 bg-warn-soft">
            <p className="text-sm">
              {valuation?.reasoning?.unavailableReason ??
                'Nessuna valutazione di mercato registrata per questo oggetto.'}
            </p>
          </Card>
        )}

        <Card>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Prezzo di acquisto</dt>
              <dd>{item.purchase_price !== null ? formatEur(item.purchase_price) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Prezzo di vendita</dt>
              <dd>{item.sale_price !== null ? formatEur(item.sale_price) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Margine</dt>
              <dd>{profit !== null ? formatEur(profit) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">ROI</dt>
              <dd>
                {profit !== null && item.purchase_price
                  ? `${Math.round((profit / item.purchase_price) * 100)}%`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Luogo di acquisto</dt>
              <dd>{item.purchase_location ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Marketplace</dt>
              <dd>{item.marketplace ?? '—'}</dd>
            </div>
          </dl>
        </Card>

        {valuation?.reasoning?.factors?.length ? (
          <Card>
            <p className="text-sm font-medium">Perche’ quel giudizio</p>
            <ul className="mt-2 space-y-1 text-sm">
              {valuation.reasoning.factors.map((factor) => (
                <li
                  key={factor.label}
                  className={factor.direction === 'positive' ? 'text-accent' : 'text-danger'}
                >
                  {factor.direction === 'positive' ? '+' : '−'} {factor.label}
                </li>
              ))}
            </ul>
          </Card>
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
                  <div className="flex items-baseline justify-between gap-3">
                    <a
                      href={comparable.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm underline decoration-line underline-offset-4"
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
      </div>
    </main>
  );
}
