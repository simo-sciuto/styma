'use client';

import { useEffect, useState } from 'react';

import { Button, Card } from '@/components/ui';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { isPersistenceEnabled } from '@/lib/supabase/env';

/**
 * «Se perdi questo browser, perdi l'archivio».
 *
 * L'app apre una sessione anonima al primo salvataggio, il che e' la cosa
 * giusta: nessuno si registra per provare un'app davanti a un banco. Il
 * problema e' che non chiedeva mai piu' niente. L'avviso esisteva, ma stava
 * in `/account`, cioe' nell'unica pagina che chi usa il prodotto non apre
 * mai, e intanto l'inventario cresceva dentro i cookie di un telefono.
 *
 * Compare al terzo oggetto salvato, non al primo: al primo non hai ancora
 * niente da perdere e la richiesta sarebbe solo un pedaggio. Al terzo hai un
 * archivio, e la frase puo' dire una cosa vera invece di una cortesia.
 *
 * Si chiude e non torna per il resto della sessione: una richiesta che
 * ricompare a ogni analisi diventa un ostacolo, e chi la ignora la ignora
 * comunque.
 */
const SOGLIA = 3;

type Stato = 'nascosto' | 'invito' | 'modulo' | 'inviato';

export function LinkAccountNudge() {
  const [stato, setStato] = useState<Stato>('nascosto');
  const [conteggio, setConteggio] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isPersistenceEnabled()) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let valido = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      // Solo chi non ha ancora un'email da recuperare: a chi ce l'ha, questa
      // richiesta non dice niente.
      if (!data.user || data.user.is_anonymous !== true) return;

      const { count } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true });

      if (valido && (count ?? 0) >= SOGLIA) {
        setConteggio(count ?? 0);
        setStato('invito');
      }
    })();

    return () => {
      valido = false;
    };
  }, []);

  async function collega() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ email, password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStato('inviato');
  }

  if (stato === 'nascosto') return null;

  if (stato === 'inviato') {
    return (
      <Card className="mt-5 bg-accent-soft">
        <p className="text-sm">
          Ti abbiamo mandato un’email di conferma. Aprila e i tuoi {conteggio} oggetti ti seguono su
          qualsiasi telefono.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-5 bg-surface-warm">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
        Mettili al sicuro
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        Hai <strong>{conteggio} oggetti</strong> salvati, e vivono solo in questo browser. Se lo
        svuoti o cambi telefono, spariscono. Basta un’email per ritrovarli ovunque.
      </p>

      {stato === 'invito' ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => setStato('modulo')}>Collega un’email</Button>
          <Button variant="ghost" onClick={() => setStato('nascosto')}>
            Non adesso
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@esempio.it"
            aria-label="La tua email"
            className="w-full rounded-block border-2 border-line bg-background px-4 py-2.5 text-base outline-none focus:border-accent"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Una password"
            aria-label="Una password"
            className="w-full rounded-block border-2 border-line bg-background px-4 py-2.5 text-base outline-none focus:border-accent"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            className="w-full"
            pending={pending}
            disabled={email.trim() === '' || password === ''}
            onClick={() => void collega()}
          >
            Collega
          </Button>
        </div>
      )}
    </Card>
  );
}
