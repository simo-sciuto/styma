'use client';

import type { PriceThresholds, Valuation } from '@/schemas/analysis';
import { formatEur } from '@/lib/format';
import { findDeals, similarForSale, type Deal } from '@/services/valuation/deals';
import { Card, Disclosure } from '@/components/ui';

/**
 * I nomi dei paesi che eBay restituisce come sigla. Solo quelli che compaiono
 * davvero: misurando cinque mercati su un oggetto reale sono tornati venditori
 * da nove paesi, Giappone compreso — sedici inserzioni su cento.
 */
const PAESI: Record<string, string> = {
  IT: 'Italia',
  DE: 'Germania',
  FR: 'Francia',
  GB: 'Regno Unito',
  ES: 'Spagna',
  NL: 'Paesi Bassi',
  AT: 'Austria',
  DK: 'Danimarca',
  BE: 'Belgio',
  PT: 'Portogallo',
  CH: 'Svizzera',
  PL: 'Polonia',
  JP: 'Giappone',
  US: 'Stati Uniti',
};

function paese(code: string | null | undefined): string | null {
  if (!code) return null;
  return PAESI[code] ?? code;
}

/**
 * Lo stesso oggetto, in vendita adesso sotto il tuo prezzo massimo.
 *
 * E' l'unico blocco della pagina che non serve a decidere su questo oggetto:
 * serve a dire che forse non e' questo l'oggetto da comprare. Le inserzioni
 * sono le stesse che hanno prodotto la stima — nessuna chiamata in piu',
 * nessun costo — lette per quello che sono anche state tutto il tempo: cose
 * comprabili. Sotto la cifra che due riquadri piu' su abbiamo chiamato «paga
 * fino a», quella e' per definizione un'occasione.
 *
 * Il blocco non compare quasi mai, ed e' giusto cosi': perche' compaia serve
 * che qualcuno stia vendendo lo stesso identico modello a prezzo fisso sotto
 * il massimo, il che sul mercato vero e' raro. Un blocco che c'e' sempre
 * insegna a saltarlo; uno che compare tre volte su cento si legge.
 */
export function Deals({
  valuation,
  thresholds,
  askingPrice,
}: {
  valuation: Valuation;
  thresholds: PriceThresholds;
  /** Quanto ti stanno chiedendo al banco, se l'hai gia' scritto. */
  askingPrice: number | null;
}) {
  const deals = findDeals(valuation, thresholds, askingPrice);
  const simili = similarForSale(valuation);
  if (deals.length === 0 && simili.length === 0) return null;

  const piuEconomico = deals[0] ?? null;
  const risparmio =
    piuEconomico !== null && askingPrice !== null
      ? Math.round(askingPrice - piuEconomico.comparedEur)
      : null;

  return (
    <Card className="bg-accent-soft">
      {deals.length > 0 && piuEconomico !== null ? (
        <>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent">
            Lo trovi gia’ in vendita
          </p>

          {/*
            La frase cambia con quello che sai. Col prezzo del banco davanti,
            la cosa utile e' il confronto diretto: «online costa venti euro in
            meno» si usa in trattativa subito. Senza, resta il confronto col
            prezzo massimo.
          */}
          <p className="mt-2 text-sm">
            {risparmio !== null && risparmio > 0 ? (
              <>
                Online lo stesso modello parte da{' '}
                <strong>{formatEur(piuEconomico.comparedEur)}</strong>:{' '}
                <strong>{formatEur(risparmio)} in meno</strong> di quanto ti stanno chiedendo.
              </>
            ) : (
              <>
                Lo stesso modello, in vendita adesso sotto il tuo massimo di{' '}
                <strong>{formatEur(thresholds.buyUpTo ?? 0)}</strong>.
              </>
            )}
          </p>

          <ul className="mt-4 space-y-3">
            {deals.map((deal) => (
              <RigaInserzione key={deal.comparable.url} deal={deal} mostraScarto />
            ))}
          </ul>

          <p className="mt-3 text-xs text-muted">
            Guarda la foto prima di fidarti: il titolo non distingue l’oggetto da un suo pezzo.
          </p>
        </>
      ) : null}

      {/*
        I simili stanno chiusi e in fondo: non sono occasioni, e confrontarli
        con il prezzo massimo sarebbe sbagliato, perche' quel massimo l'abbiamo
        calcolato per un altro oggetto. Servono a dare un contorno al mercato.
      */}
      {simili.length > 0 ? (
        <div className={deals.length > 0 ? 'mt-4 border-t-2 border-line pt-4' : ''}>
          <Disclosure
            summary="Oggetti simili in vendita"
            hint={`${simili.length} della stessa marca o famiglia, da ${formatEur(simili[0]!.comparedEur)}`}
          >
            <ul className="space-y-3">
              {simili.map((deal) => (
                <RigaInserzione key={deal.comparable.url} deal={deal} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Non sono lo stesso modello: il prezzo massimo qui sopra non vale per loro.
            </p>
          </Disclosure>
        </div>
      ) : null}
    </Card>
  );
}

function RigaInserzione({ deal, mostraScarto = false }: { deal: Deal; mostraScarto?: boolean }) {
  const da = paese(deal.comparable.country);
  const { sellerRating, sellerVotes } = deal.comparable;

  return (
    <li className="flex gap-3 rounded-block border-2 border-line bg-surface p-3">
      {deal.comparable.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={deal.comparable.imageUrl}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-[0.5rem] border-2 border-line object-cover"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatEur(deal.priceEur)}
          </span>
          {/*
            La spedizione si somma solo dove la conosciamo davvero. eBay
            dichiara il costo verso il paese del mercato che stai
            interrogando: su un'inserzione trovata su eBay.de quella cifra e'
            quanto pagherebbe un tedesco.
          */}
          {deal.landedEur !== null ? (
            <span className="font-mono text-xs text-muted">
              + {formatEur(deal.landedEur - deal.priceEur)} sped. ={' '}
              <strong className="text-foreground">{formatEur(deal.landedEur)}</strong>
            </span>
          ) : (
            <span className="text-xs text-muted">spedizione a parte</span>
          )}
        </p>

        <a
          href={deal.comparable.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-0.5 line-clamp-2 block text-sm underline decoration-line underline-offset-4"
        >
          {deal.comparable.title}
        </a>

        <p className="mt-1 text-xs text-muted">
          {[
            da ? `da ${da}` : null,
            /* Il voto del venditore non entra in nessun calcolo e non deve:
               e' una cosa da guardare prima di comprare da uno sconosciuto,
               non un ingrediente della stima. Il numero di voti sta accanto
               alla percentuale perche' un 100% su tre voti non e' un 100% su
               quattromila. */
            sellerRating !== null && sellerRating !== undefined
              ? `venditore ${sellerRating}%${sellerVotes ? ` su ${sellerVotes} voti` : ''}`
              : null,
            mostraScarto && deal.underByEur > 0
              ? `${formatEur(deal.underByEur)} sotto il tuo massimo`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </li>
  );
}
