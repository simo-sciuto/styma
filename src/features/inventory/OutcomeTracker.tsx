'use client';

import { useState, useTransition, type ReactNode } from 'react';

import { Button, Card, TextButton } from '@/components/ui';
import { formatEur } from '@/lib/format';
import type { OutcomeInput } from '@/schemas/outcome';
import type { Outcome } from '@/services/inventory/outcome';
import type { ItemRow } from '@/services/inventory/types';
import { recordOutcome } from './actions';

/**
 * Cosa e' successo dopo l'analisi: comprato, lasciato perdere, venduto.
 *
 * E' la sola parte del prodotto in cui i numeri arrivano dal mondo e non da
 * noi, e serve prima di tutto a chi la compila: quello che compra finisce nel
 * conto di quanto sta guadagnando, quello che lascia resta come una scommessa
 * che puo' riaprire. Che di riflesso dica anche a STYMA se le sue stime
 * reggono e' vero, ed e' esattamente il motivo che non si scrive in pagina:
 * nessuno preme un bottone per fare un favore a un'app.
 *
 * Ogni passaggio chiede solo cio' che quel passaggio sa davvero. Le date
 * partono da oggi perche' questo si compila appena successo, ma restano
 * modificabili: una vendita di tre giorni fa non deve diventare di oggi solo
 * perche' era piu' comodo non chiedere.
 */

const today = () => new Date().toISOString().slice(0, 10);

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{children}</p>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <Eyebrow>{label}</Eyebrow>
      <span className="mt-1.5 flex items-center gap-2 rounded-block border-2 border-line bg-background px-4 py-2.5 focus-within:border-accent">
        <span className="text-xl text-muted">€</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={value}
          // Il campo compare dopo un tocco esplicito su "l'ho comprato": e'
          // l'unica cosa da fare nel riquadro appena aperto, e su un telefono
          // risparmia il secondo tocco per aprire la tastiera.
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
        />
      </span>
    </label>
  );
}

function PlainInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: 'text' | 'date';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <Eyebrow>{label}</Eyebrow>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-block border-2 border-line bg-background px-4 py-2.5 text-base outline-none focus:border-accent"
      />
    </label>
  );
}

/** Una riga di numeri: etichetta sopra, cifra sotto, in monospazio. */
function Figure({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-accent' : tone === 'bad' ? 'text-danger' : '';
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

type FormKind = 'bought' | 'listed' | 'sold' | 'costs' | null;

/**
 * `outcome` arriva gia' calcolato dal server invece di essere ricavato qui:
 * dipende da che giorno e' oggi, e un "ce l'hai da 19 giorni" calcolato due
 * volte a cavallo di mezzanotte darebbe due numeri diversi fra HTML e
 * idratazione.
 */
export function OutcomeTracker({ item, outcome }: { item: ItemRow; outcome: Outcome }) {
  const [form, setForm] = useState<FormKind>(null);
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [where, setWhere] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(kind: Exclude<FormKind, null>) {
    setError(null);
    setForm(kind);
    setDate(today());
    // Il prezzo chiesto e' la partenza piu' probabile di una trattativa: chi
    // non ha trattato conferma e va avanti, chi ha trattato corregge.
    setPrice(
      kind === 'bought' && item.asking_price !== null
        ? String(item.asking_price)
        : kind === 'costs' && item.extra_costs !== null
          ? String(item.extra_costs)
          : '',
    );
    setWhere(kind === 'costs' ? (item.extra_costs_note ?? '') : '');
  }

  function submit(input: OutcomeInput) {
    setError(null);
    startTransition(async () => {
      const result = await recordOutcome(item.id, input);
      if (!result.ok) setError(result.error);
      else setForm(null);
    });
  }

  const amount = Number.parseFloat(price.replace(',', '.'));
  const amountValid = Number.isFinite(amount) && amount >= 0;

  if (form === 'costs') {
    /*
     * Una cifra e una nota. Non una tabella di voci, e non una data: chi sta
     * chiudendo una vendita scrive «35, ricambi e pulizia» in tre secondi e va
     * avanti, e un modulo a righe multiple non lo compila nessuno. Un dato
     * che nessuno compila vale meno di un dato approssimato.
     */
    return (
      <Card>
        <Eyebrow>Quanto ci hai speso sopra</Eyebrow>
        <p className="mt-1.5 text-sm text-muted">
          Pulizia, ricambi, trasporto, l’ingresso al mercato. Escono dalla stessa tasca del prezzo
          d’acquisto, e senza di loro il guadagno sembra piu’ alto di quello che e’.
        </p>

        <div className="mt-4 space-y-4">
          <MoneyInput label="Quanto, in tutto" value={price} onChange={setPrice} autoFocus />
          <PlainInput
            label="In che cosa"
            value={where}
            onChange={setWhere}
            placeholder="Ricambi e pulizia"
          />
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button
            pending={pending}
            disabled={!amountValid}
            onClick={() => submit({ type: 'costs', amount: amount, note: where })}
          >
            Registra
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setForm(null)}>
            Annulla
          </Button>
        </div>
      </Card>
    );
  }

  if (form !== null) {
    const isBought = form === 'bought';
    const needsPrice = form !== 'listed';

    return (
      <Card>
        <Eyebrow>
          {isBought ? 'L’hai comprato' : form === 'sold' ? 'L’hai venduto' : 'L’hai messo in vendita'}
        </Eyebrow>

        <div className="mt-4 space-y-4">
          {needsPrice ? (
            <MoneyInput
              label={isBought ? 'Quanto hai pagato davvero' : 'A quanto l’hai venduto'}
              value={price}
              onChange={setPrice}
              autoFocus
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <PlainInput label="Quando" type="date" value={date} onChange={setDate} />
            <PlainInput
              label={isBought ? 'Dove' : 'Su quale piattaforma'}
              value={where}
              onChange={setWhere}
              placeholder={isBought ? 'Mercatino di Porta Portese' : 'Vinted'}
            />
          </div>
        </div>

        {isBought && item.asking_price !== null && amountValid && amount < item.asking_price ? (
          <p className="mt-3 text-sm text-accent">
            {formatEur(item.asking_price - amount)} in meno di quanto chiedevano.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button
            pending={pending}
            disabled={needsPrice && !amountValid}
            onClick={() => {
              const marketplace = where;
              if (form === 'bought') submit({ type: 'bought', price: amount, date, location: where });
              else if (form === 'sold') submit({ type: 'sold', price: amount, date, marketplace });
              else submit({ type: 'listed', date, marketplace });
            }}
          >
            Registra
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setForm(null)}>
            Annulla
          </Button>
        </div>
      </Card>
    );
  }

  if (outcome.kind === 'open') {
    return (
      <Card>
        {/*
          «Com'e' andata» era il titolo sbagliato nel momento sbagliato: qui
          non e' ancora andata in nessun modo, la domanda arriva mentre hai
          l'oggetto in mano.

          E il testo sotto spiegava perche' la risposta serve *a noi* —
          «e' l'unico modo di sapere se questa app ci aveva visto giusto» —
          il che e' vero e non e' un motivo per cui qualcuno dovrebbe premere
          un bottone. Le due risposte servono a chi le da': quello che compri
          entra nel conto di quanto stai guadagnando, quello che lasci resta
          come una scommessa da riaprire.
        */}
        <Eyebrow>Che fine ha fatto</Eyebrow>
        {/* Una domanda sola, corta. «Te lo chiedevano 99 €. L'hai comprato?»
            metteva un'informazione davanti alla domanda, e su una riga stretta
            la domanda finiva a capo, dopo un prezzo: si leggeva il prezzo e si
            saltava il resto. Il prezzo e' contesto, quindi sta sotto e piano. */}
        <p className="mt-2 text-2xl font-semibold tracking-tight">L’hai comprato?</p>
        {item.asking_price !== null ? (
          <p className="mt-0.5 text-sm text-muted">
            Ne chiedevano {formatEur(item.asking_price)}.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Button className="w-full" pending={pending} onClick={() => open('bought')}>
              Si’, l’ho comprato
            </Button>
            <p className="mt-1.5 text-xs text-muted">
              Entra nel conto di quanto hai speso e quanto ti resta.
            </p>
          </div>
          <div>
            <Button
              className="w-full"
              variant="ghost"
              pending={pending}
              onClick={() => submit({ type: 'passed' })}
            >
              No, l’ho lasciato li’
            </Button>
            <p className="mt-1.5 text-xs text-muted">
              Resta qui: se fra un mese vale il doppio, lo scopri.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (outcome.kind === 'passed') {
    return (
      <Card>
        <Eyebrow>Che fine ha fatto</Eyebrow>
        <p className="mt-2 text-xl font-semibold tracking-tight">L’hai lasciato li’.</p>
        {outcome.askingPrice !== null ? (
          <p className="mt-1 text-sm text-muted">
            Ne chiedevano {formatEur(outcome.askingPrice)}. Se un giorno scopri che valeva la pena,
            questa riga te lo ricorda.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <TextButton pending={pending} onClick={() => submit({ type: 'reopen' })}>
          Non e’ andata cosi’
        </TextButton>
      </Card>
    );
  }

  if (outcome.kind === 'holding') {
    return (
      <Card>
        <Eyebrow>{outcome.listed ? 'In vendita' : 'Ce l’hai in magazzino'}</Eyebrow>

        <div className="mt-3 grid grid-cols-2 gap-4">
          {outcome.purchasePrice !== null ? (
            <Figure label="Pagato" value={formatEur(outcome.purchasePrice)} />
          ) : null}
          {outcome.negotiated !== null && outcome.negotiated > 0 ? (
            <Figure
              label="Trattato"
              value={`−${formatEur(outcome.negotiated)}`}
              tone="good"
            />
          ) : null}
          {outcome.extraCosts !== null ? (
            <Figure label="Ci hai speso" value={`+${formatEur(outcome.extraCosts)}`} tone="bad" />
          ) : null}
          {outcome.listed && outcome.daysOnMarket !== null ? (
            <Figure label="In vendita da" value={`${outcome.daysOnMarket} gg`} />
          ) : outcome.daysHeld !== null ? (
            <Figure label="Ce l’hai da" value={`${outcome.daysHeld} gg`} />
          ) : null}
        </div>

        {outcome.extraCostsNote ? (
          <p className="mt-2 text-xs text-muted">{outcome.extraCostsNote}</p>
        ) : null}

        <TextButton className="mt-3" pending={pending} onClick={() => open('costs')}>
          {outcome.extraCosts !== null ? 'Correggi quanto ci hai speso' : 'Ci ho speso altro'}
        </TextButton>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button pending={pending} onClick={() => open('sold')}>
            L’ho venduto
          </Button>
          {!outcome.listed ? (
            <Button variant="ghost" pending={pending} onClick={() => open('listed')}>
              L’ho messo in vendita
            </Button>
          ) : (
            <Button variant="ghost" pending={pending} onClick={() => submit({ type: 'reopen' })}>
              Ricomincia da capo
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const { vsEstimate } = outcome;

  return (
    <Card>
      <Eyebrow>Venduto{outcome.marketplace ? ` su ${outcome.marketplace}` : ''}</Eyebrow>

      <p className="mt-2 text-[clamp(1.75rem,1.5rem+1.4vw,2.5rem)] font-semibold leading-none tracking-tight">
        {formatEur(outcome.salePrice)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t-2 border-line pt-4 sm:grid-cols-4">
        {outcome.purchasePrice !== null ? (
          <Figure label="Pagato" value={formatEur(outcome.purchasePrice)} />
        ) : null}
        {outcome.extraCosts !== null && outcome.extraCosts > 0 ? (
          <Figure label="Ci hai speso" value={`+${formatEur(outcome.extraCosts)}`} tone="bad" />
        ) : null}
        {outcome.grossMargin !== null ? (
          <Figure
            label="Guadagno"
            value={`${outcome.grossMargin >= 0 ? '+' : ''}${formatEur(outcome.grossMargin)}`}
            tone={outcome.grossMargin > 0 ? 'good' : 'bad'}
          />
        ) : null}
        {outcome.daysOnMarket !== null ? (
          <Figure label="Sul mercato" value={`${outcome.daysOnMarket} gg`} />
        ) : outcome.daysHeld !== null ? (
          <Figure label="Tenuto" value={`${outcome.daysHeld} gg`} />
        ) : null}
      </div>

      {/* Il momento in cui il prodotto puo' essere smentito. Se la fascia era
          sbagliata si dice qui, con lo stesso rilievo di quando e' giusta. */}
      {vsEstimate ? (
        <div
          className={`mt-4 rounded-block p-4 text-sm ${
            vsEstimate.verdict === 'inside' ? 'bg-accent-soft text-accent' : 'bg-warn-soft text-warn'
          }`}
        >
          {vsEstimate.verdict === 'inside'
            ? `La stima diceva ${formatEur(vsEstimate.low)}–${formatEur(vsEstimate.high)}: ci siamo.`
            : vsEstimate.verdict === 'above'
              ? `L’avevamo sottovalutato: la stima si fermava a ${formatEur(vsEstimate.high)}.`
              : `L’avevamo sopravvalutato: la stima partiva da ${formatEur(vsEstimate.low)}.`}
        </div>
      ) : null}


      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <TextButton pending={pending} onClick={() => submit({ type: 'reopen' })}>
        Correggi
      </TextButton>
    </Card>
  );
}
