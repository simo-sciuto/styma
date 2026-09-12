'use client';

import { useState, useTransition, type ReactNode } from 'react';

import { Button, Card, TextButton } from '@/components/ui';
import { formatEur } from '@/lib/format';
import type { OutcomeInput } from '@/schemas/outcome';
import type { Outcome } from '@/services/inventory/outcome';
import { viewOutcome, type OutcomeView } from '@/services/inventory/outcome-view';
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

/**
 * Il telaio di ogni stato: dove sei, i soldi, la mossa.
 *
 * Le parole e i numeri li decide `viewOutcome`, che e' puro e testato: qui
 * resta solo come si dispongono. Prima ogni stato si costruiva la sua scheda
 * dentro un ramo dell'`if`, e le quattro schede sono divergite una dall'altra
 * senza che nessuno lo decidesse.
 */
function Stato({
  vista,
  error,
  children,
}: {
  vista: OutcomeView;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <Eyebrow>{vista.stato}</Eyebrow>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-balance">{vista.frase}</p>

      {vista.figure.length > 0 ? (
        <div className="mt-4 border-t-2 border-line pt-4">
          <div className="grid grid-cols-2 gap-4">
            {vista.figure.map((figura) => (
              <Figure key={figura.label} {...figura} />
            ))}
          </div>
          {vista.dettagli ? <p className="mt-2 text-xs text-muted">{vista.dettagli}</p> : null}
          {vista.stima ? (
            <p
              className={`mt-3 rounded-block p-3 text-sm ${
                vista.stima.centrata ? 'bg-accent-soft text-accent' : 'bg-warn-soft text-warn'
              }`}
            >
              {vista.stima.testo}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-5">{children}</div>
    </Card>
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
          Pulizia, ricambi, trasporto, ingresso al mercato. Senza, il guadagno sembra piu’ alto di
          quello che e’.
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

  /*
   * Da qui in poi cambiano solo i bottoni.
   *
   * Cosa c'e' scritto lo decide `viewOutcome`, in un posto solo e provato a
   * tavolino; qui resta la domanda che il componente e' l'unico a poter
   * rispondere, cioe' cosa si puo' fare adesso. Quattro rami che rendevano
   * quattro schede diverse sono diventati quattro liste di bottoni.
   */
  const vista = viewOutcome(outcome, item.asking_price);

  return (
    <Stato vista={vista} error={error}>
      {outcome.kind === 'open' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button pending={pending} onClick={() => open('bought')}>
            L’ho comprato
          </Button>
          <Button variant="ghost" pending={pending} onClick={() => submit({ type: 'passed' })}>
            L’ho lasciato li’
          </Button>
        </div>
      ) : outcome.kind === 'holding' ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button pending={pending} onClick={() => open('sold')}>
              L’ho venduto
            </Button>
            {outcome.listed ? (
              <Button variant="ghost" pending={pending} onClick={() => submit({ type: 'reopen' })}>
                Ricomincia da capo
              </Button>
            ) : (
              <Button variant="ghost" pending={pending} onClick={() => open('listed')}>
                L’ho messo in vendita
              </Button>
            )}
          </div>
          <TextButton className="mt-3" pending={pending} onClick={() => open('costs')}>
            {outcome.extraCosts !== null ? 'Correggi le spese' : 'Ci ho speso altro'}
          </TextButton>
        </>
      ) : (
        <TextButton pending={pending} onClick={() => submit({ type: 'reopen' })}>
          {outcome.kind === 'passed' ? 'Non e’ andata cosi’' : 'Correggi'}
        </TextButton>
      )}
    </Stato>
  );
}
