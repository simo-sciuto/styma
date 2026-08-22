'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card } from '@/components/ui';
import type { PreparedImage } from '@/lib/images';
import { ensureSession, getBrowserSupabase } from '@/lib/supabase/client';
import { isPersistenceEnabled } from '@/lib/supabase/env';
import type { AnalysisResult } from '@/schemas/analysis';
import { IMAGE_BUCKET } from '@/services/inventory/types';
import { registerImages, saveAnalysis } from './actions';

type Props = {
  result: AnalysisResult;
  purchasePrice: number | null;
  images: PreparedImage[];
};

export function SaveToInventory({ result, purchasePrice, images }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPersistenceEnabled()) {
    return (
      <p className="pt-2 text-center text-xs text-muted">
        Inventario non configurato: manca la connessione a Supabase.
      </p>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const userId = await ensureSession();

      const saved = await saveAnalysis(result, purchasePrice);
      if (!saved.ok) throw new Error(saved.error);

      const supabase = getBrowserSupabase();
      if (supabase && images.length > 0) {
        const paths: string[] = [];
        for (const [index, image] of images.entries()) {
          const path = `${userId}/${saved.itemId}/${String(index).padStart(2, '0')}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(path, image.file, { contentType: image.file.type, upsert: true });
          // Una foto non caricata non deve far perdere l'analisi appena salvata.
          if (!uploadError) paths.push(path);
        }
        await registerImages(saved.itemId, paths);
      }

      router.push(`/inventario/${saved.itemId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Salvataggio non riuscito.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" disabled={saving} onClick={() => void save()}>
        {saving ? 'Salvo…' : 'Salva in inventario'}
      </Button>
      {error ? (
        <Card className="border-danger/40 bg-danger-soft">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}
    </div>
  );
}
