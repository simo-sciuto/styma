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

/**
 * Il telaio di ogni stato: dove sei, i soldi, la mossa.
 *
 * Prima ogni stato era una scheda a se': titolo diverso, impaginazione
 * diversa, bottoni che cambiavano significato sotto lo stesso posto. Chi la
 * riapriva doveva ricapire ogni volta cosa stava guardando, ed e' il motivo
 * per cui la scatola sembrava non servire a niente.
 *
 * Adesso sono sempre le stesse quattro righe, nello stesso ordine:
 *
 *   STATO    a che punto e' questo oggetto, detto in una parola
 *   frase    cos'e' successo, con le date e i prezzi dentro
 *   soldi    quanto e' uscito e quanto rientra — la riga che mancava
 *   mossa    l'unica cosa che ha senso fare adesso
 *
 * La riga dei soldi e' quella che rende utile la scatola: dice se stai
 * guadagnando su *questo* oggetto senza doverlo cercare nel cruscotto. E in
 * magazzino guarda avanti invece che indietro — quanto ne fai se lo vendi al
 * valore atteso — che e' la domanda di chi ce l'ha sullo scaffale.
 */
function Stato({
  stato,
  frase,
  soldi,
  error,
  children,
}: {
  stato: string;
  frase: string;
  soldi?: ReactNode;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <Eyebrow>{stato}</Eyebrow>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-balance">{frase}</p>
      {soldi ? <div className="mt-4 border-t-2 border-line pt-4">{soldi}</div> : null}
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

  if (outcome.kind === 'open') {
    return (
      <Stato
        stato="Da decidere"
        frase={
          item.asking_price !== null
            ? `Te lo chiedono ${formatEur(item.asking_price)}: l’hai comprato?`
            : 'L’hai comprato?'
        }
        error={error}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Button pending={pending} onClick={() => open('bought')}>
            L’ho comprato
          </Button>
          <Button variant="ghost" pending={pending} onClick={() => submit({ type: 'passed' })}>
            L’ho lasciato li’
          </Button>
        </div>
      </Stato>
    );
  }

  if (outcome.kind === 'passed') {
    return (
      <Stato
        stato="Lasciato li’"
        frase={
          outcome.askingPrice !== null
            ? `Ne chiedevano ${formatEur(outcome.askingPrice)} e non l’hai preso.`
            : 'Non l’hai preso.'
        }
        error={error}
      >
        <TextButton pending={pending} onClick={() => submit({ type: 'reopen' })}>
          Non e’ andata cosi’
        </TextButton>
      </Stato>
    );
  }

  if (outcome.kind === 'holding') {
    // Quanto ti e' costato davvero: il prezzo piu' quello che ci hai speso
    // sopra. La pulizia e i ricambi escono dalla stessa tasca, e tenerli
    // fuori fa sembrare ogni guadagno piu' grande di quello che e'.
    const speso =
      outcome.purchasePrice === null
        ? null
        : outcome.purchasePrice + (outcome.extraCosts ?? 0);
    const guadagno =
      speso === null || outcome.likelyValue === null ? null : outcome.likelyValue - speso;

    // Due mezze frasi, e la seconda sa se e' la prima o la seconda della
    // riga. Concatenandole a pezzi si perdeva lo spazio fra un punto e la
    // maiuscola dopo, quando il prezzo di acquisto non c'era.
    const giorni = outcome.listed ? outcome.daysOnMarket : outcome.daysHeld;
    const quanto = speso === null ? null : `Ti e’ costato ${formatEur(speso)}`;
    const da = giorni === null
      ? null
      : `${outcome.listed ? 'in vendita da' : 'ce l’hai da'} ${giorni} giorni`;
    const frase =
      quanto && da
        ? `${quanto}, ${da}.`
        : quanto
          ? `${quanto}.`
          : da
            ? `${da.charAt(0).toUpperCase()}${da.slice(1)}.`
            : 'L’hai comprato.';

    return (
      <Stato
        stato={outcome.listed ? 'In vendita' : 'In magazzino'}
        frase={frase}
        soldi={
          <>
            <div className="grid grid-cols-2 gap-4">
              <Figure label="Ti e’ costato" value={speso === null ? '—' : formatEur(speso)} />
              {/* La sola cifra di questa scatola che guarda avanti: al valore
                  atteso della stima, quanto ti resta in mano. */}
              {guadagno !== null ? (
                <Figure
                  label={`Venduto a ${formatEur(outcome.likelyValue ?? 0)}`}
                  value={`${guadagno >= 0 ? '+' : ''}${formatEur(guadagno)}`}
                  tone={guadagno > 0 ? 'good' : 'bad'}
                />
              ) : null}
            </div>

            {outcome.extraCosts !== null && outcome.extraCosts > 0 ? (
              <p className="mt-2 text-xs text-muted">
                Dentro ci sono {formatEur(outcome.extraCosts)} di spese
                {outcome.extraCostsNote ? ` (${outcome.extraCostsNote})` : ''}.
              </p>
            ) : null}

            <TextButton className="mt-2" pending={pending} onClick={() => open('costs')}>
              {outcome.extraCosts !== null ? 'Correggi le spese' : 'Ci ho speso altro'}
            </TextButton>
          </>
        }
        error={error}
      >
        <div className="grid gap-2 sm:grid-cols-2">
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
      </Stato>
    );
  }

  const { vsEstimate } = outcome;
  const speso =
    outcome.purchasePrice === null ? null : outcome.purchasePrice + (outcome.extraCosts ?? 0);
  const giorni = outcome.daysOnMarket ?? outcome.daysHeld;

  return (
    <Stato
      stato="Venduto"
      frase={[
        `L’hai venduto a ${formatEur(outcome.salePrice)}`,
        outcome.marketplace ? ` su ${outcome.marketplace}` : '',
        giorni === null ? '' : `, dopo ${giorni} giorni`,
        '.',
      ].join('')}
      soldi={
        <>
          <div className="grid grid-cols-2 gap-4">
            <Figure label="Ti e’ costato" value={speso === null ? '—' : formatEur(speso)} />
            {outcome.grossMargin !== null ? (
              <Figure
                label="Ci hai guadagnato"
                value={`${outcome.grossMargin >= 0 ? '+' : ''}${formatEur(outcome.grossMargin)}`}
                tone={outcome.grossMargin > 0 ? 'good' : 'bad'}
              />
            ) : null}
          </div>

          {outcome.extraCosts !== null && outcome.extraCosts > 0 ? (
            <p className="mt-2 text-xs text-muted">
              Dentro ci sono {formatEur(outcome.extraCosts)} di spese
              {outcome.extraCostsNote ? ` (${outcome.extraCostsNote})` : ''}.
            </p>
          ) : null}

          {/* Il momento in cui il prodotto puo' essere smentito. Se la fascia
              era sbagliata si dice qui, con lo stesso rilievo di quando e'
              giusta. */}
          {vsEstimate ? (
            <p
              className={`mt-3 rounded-block p-3 text-sm ${
                vsEstimate.verdict === 'inside'
                  ? 'bg-accent-soft text-accent'
                  : 'bg-warn-soft text-warn'
              }`}
            >
              {vsEstimate.verdict === 'inside'
                ? `La stima diceva ${formatEur(vsEstimate.low)}–${formatEur(vsEstimate.high)}: ci siamo.`
                : vsEstimate.verdict === 'above'
                  ? `L’avevamo sottovalutato: la stima si fermava a ${formatEur(vsEstimate.high)}.`
                  : `L’avevamo sopravvalutato: la stima partiva da ${formatEur(vsEstimate.low)}.`}
            </p>
          ) : null}
        </>
      }
      error={error}
    >
      <TextButton pending={pending} onClick={() => submit({ type: 'reopen' })}>
        Correggi
      </TextButton>
    </Stato>
  );
}
