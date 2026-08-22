'use client';

import { useState } from 'react';

import { Button, Card, Field } from '@/components/ui';
import type { PreparedImage } from '@/lib/images';
import type { AnalysisResult } from '@/schemas/analysis';
import type { Identification } from '@/schemas/identification';
import { SaveToInventory } from '@/features/inventory/SaveToInventory';
import { PhotoPicker } from './PhotoPicker';
import { ResultView } from './ResultView';

type Stage = 'idle' | 'identifying' | 'researching' | 'done';

/** Ogni messaggio corrisponde a una fase reale del backend, non a un timer. */
const STAGE_MESSAGES: Record<Exclude<Stage, 'idle' | 'done'>, string> = {
  identifying: 'Leggo l’oggetto e i suoi marchi…',
  researching: 'Cerco vendite comparabili e stimo il valore…',
};

function parsePurchasePrice(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AnalyzeFlow() {
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = stage === 'identifying' || stage === 'researching';

  async function analyze() {
    setError(null);
    setResult(null);
    setIdentification(null);
    setStage('identifying');

    try {
      const formData = new FormData();
      for (const image of images) formData.append('images', image.file);

      const identifyResponse = await fetch('/api/identify', { method: 'POST', body: formData });
      if (!identifyResponse.ok) {
        throw new Error(await readError(identifyResponse, 'Identificazione non riuscita.'));
      }

      const { identification: identified } = (await identifyResponse.json()) as {
        identification: Identification;
      };
      setIdentification(identified);
      setStage('researching');

      const parsedPrice = parsePurchasePrice(purchasePrice);

      const valuateResponse = await fetch('/api/valuate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identification: identified,
          purchasePrice: parsedPrice,
        }),
      });
      if (!valuateResponse.ok) {
        throw new Error(await readError(valuateResponse, 'Valutazione non riuscita.'));
      }

      setResult((await valuateResponse.json()) as AnalysisResult);
      setStage('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qualcosa e’ andato storto.');
      setStage('idle');
    }
  }

  function reset() {
    for (const image of images) URL.revokeObjectURL(image.previewUrl);
    setImages([]);
    setPurchasePrice('');
    setResult(null);
    setIdentification(null);
    setError(null);
    setStage('idle');
  }

  if (stage === 'done' && result) {
    return (
      <>
        <ResultView
          result={result}
          saveSlot={
            <SaveToInventory
              result={result}
              purchasePrice={parsePurchasePrice(purchasePrice)}
              images={images}
            />
          }
        />
        <Button variant="ghost" className="mt-6 w-full" onClick={reset}>
          Analizza un altro oggetto
        </Button>
      </>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analizza un oggetto</h1>
        <p className="mt-1 text-sm text-muted">
          Da 4 a 8 foto danno il risultato migliore. Se l’oggetto e’ evidente, ne bastano meno.
        </p>
      </div>

      <PhotoPicker images={images} onChange={setImages} disabled={busy} />

      <Card>
        <Field
          label="Prezzo richiesto (facoltativo)"
          hint="Se lo indichi, ti diciamo se a quel prezzo conviene comprarlo."
        >
          <div className="flex items-center gap-2">
            <span className="text-muted">€</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={purchasePrice}
              disabled={busy}
              onChange={(event) => setPurchasePrice(event.target.value)}
              placeholder="25"
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base outline-none focus:border-accent"
            />
          </div>
        </Field>
      </Card>

      {error ? (
        <Card className="border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {busy ? (
        <Card>
          <p className="text-sm" style={{ animation: 'styma-pulse 1.6s ease-in-out infinite' }}>
            {STAGE_MESSAGES[stage]}
          </p>
          {identification ? (
            <p className="mt-3 text-sm text-muted">
              Riconosciuto: <strong className="text-foreground">{identification.name}</strong>
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            Può volerci fino a un minuto: stiamo consultando vendite reali.
          </p>
        </Card>
      ) : (
        <Button className="w-full" disabled={images.length === 0} onClick={() => void analyze()}>
          Analizza
        </Button>
      )}
    </div>
  );
}
