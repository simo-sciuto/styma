'use client';

import type { Identification } from '@/schemas/identification';
import { CONDITION_LABELS } from '@/lib/format';
import { Disclosure } from '@/components/ui';

const IMAGE_QUALITY_NOTES: Record<string, string> = {
  mixed: 'Le foto ricevute sono di qualita’ mista: qualche dettaglio resta interpretato.',
  poor: 'Le foto ricevute sono poco leggibili: l’identificazione poggia su meno di quanto vorremmo.',
};

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

/**
 * Perche' pensiamo che sia questo.
 *
 * Il modello scrive gia' i motivi della sua confidenza — perche' e' alta,
 * perche' e' bassa — e fino a qui l'interfaccia li buttava via, mostrando la
 * percentuale nuda. Una percentuale senza motivi si puo' solo credere o non
 * credere; con i motivi si puo' controllare, ed e' l'unica cosa che rende
 * discutibile un'attribuzione invece che oracolare.
 *
 * I marchi letti stanno in evidenza e in monospazio: sono la prova piu' forte
 * che esista qui dentro, e vanno mostrati come una trascrizione — questo
 * abbiamo letto, controlla tu se corrisponde — non come un attributo fra gli
 * altri.
 */
export function ObjectEvidence({ identification }: { identification: Identification }) {
  const {
    confidence,
    confidenceReasons,
    markings,
    materials,
    characteristics,
    conditionNotes,
    condition,
    period,
    brand,
    model,
    objectType,
    imageQuality,
    missingShots,
  } = identification;

  const qualityNote = IMAGE_QUALITY_NOTES[imageQuality];

  return (
    <Disclosure summary={`Perche’ pensiamo sia questo (${Math.round(confidence * 100)}%)`}>
      {confidenceReasons.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {confidenceReasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden className="text-muted">
                —
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Nessun motivo dichiarato: l’identificazione al {Math.round(confidence * 100)}% poggia sul
          riconoscimento visivo e basta.
        </p>
      )}

      {qualityNote ? <p className="mt-3 text-xs text-warn">{qualityNote}</p> : null}

      {markings.length > 0 ? (
        <div className="mt-4 rounded-block border-2 border-line bg-surface-warm p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Letto sull’oggetto
          </p>
          <ul className="mt-2 space-y-1">
            {markings.map((mark) => (
              <li key={mark} className="font-mono text-sm">
                “{mark}”
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Trascritto dalle foto, non dedotto. Controlla che corrisponda a quello che hai in mano.
          </p>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Detail label="Tipo" value={objectType} />
        <Detail label="Epoca" value={period} />
        <Detail label="Marca" value={brand} />
        <Detail label="Modello" value={model} />
        <Detail label="Materiale" value={materials.length > 0 ? materials.join(', ') : null} />
        <Detail label="Stato" value={CONDITION_LABELS[condition] ?? condition} />
      </dl>

      {characteristics.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Cosa lo distingue
          </p>
          <p className="mt-1 text-sm text-muted">{characteristics.join(' · ')}</p>
        </div>
      ) : null}

      {conditionNotes.length > 0 ? (
        <div className="mt-4 rounded-block border-2 border-line bg-warn-soft p-4">
          <p className="text-xs font-medium text-warn">Difetti visti nelle foto</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {conditionNotes.map((note) => (
              <li key={note}>— {note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        Non e' un rimprovero sulle foto: e' la cosa piu' utile che possiamo
        dire quando l'identificazione e' incerta. Sapere *quale* scatto manca
        vale piu' di un invito generico a fotografare meglio.
      */}
      {missingShots.length > 0 ? (
        <div className="mt-4 border-t-2 border-line pt-4">
          <p className="text-sm font-medium">Una foto in piu’ aiuterebbe</p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted">
            {missingShots.map((shot) => (
              <li key={shot}>— {shot}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Disclosure>
  );
}
