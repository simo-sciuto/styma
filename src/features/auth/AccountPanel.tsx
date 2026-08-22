'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, Field } from '@/components/ui';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { isPersistenceEnabled } from '@/lib/supabase/env';

type Identity = { userId: string; email: string | null; anonymous: boolean } | null;

export function AccountPanel() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity>(null);
  // Senza Supabase non c'e' nulla da caricare: evitiamo un giro di stato inutile.
  const [loading, setLoading] = useState(() => getBrowserSupabase() !== null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      setIdentity(
        user ? { userId: user.id, email: user.email ?? null, anonymous: user.is_anonymous === true } : null,
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isPersistenceEnabled()) {
    return (
      <Card>
        <p className="text-sm">Account non disponibile: manca la connessione a Supabase.</p>
      </Card>
    );
  }

  if (loading) return <Card><p className="text-sm text-muted">…</p></Card>;

  /** Trasforma la sessione anonima in un account vero, mantenendo lo stesso utente. */
  async function linkAccount() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ email, password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage(
      'Ti abbiamo inviato un’email di conferma. Finché non la apri, l’inventario resta legato a questo browser.',
    );
  }

  async function signIn() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.refresh();
    router.push('/inventario');
  }

  async function signOut() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.refresh();
    router.push('/');
  }

  const linking = identity?.anonymous === true;

  if (identity && !identity.anonymous) {
    return (
      <Card>
        <p className="text-sm text-muted">Sei entrato come</p>
        <p className="mt-1 font-medium">{identity.email}</p>
        <p className="mt-3 text-sm text-muted">
          Il tuo inventario ti segue su qualsiasi dispositivo.
        </p>
        <Button variant="ghost" className="mt-4 w-full" onClick={() => void signOut()}>
          Esci
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold">
          {linking ? 'Non perdere il tuo inventario' : 'Entra nel tuo account'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {linking
            ? 'Stai usando una sessione anonima: quello che salvi vive solo in questo browser. Collega un’email e te lo ritrovi ovunque.'
            : 'Se hai già un account, entra. Altrimenti analizza un oggetto: l’account puoi crearlo dopo, senza perdere nulla.'}
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base outline-none focus:border-accent"
            />
          </Field>
          <Field label="Password" hint={linking ? 'Almeno 8 caratteri.' : undefined}>
            <input
              type="password"
              autoComplete={linking ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base outline-none focus:border-accent"
            />
          </Field>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={busy || email.trim() === '' || password === ''}
          onClick={() => void (linking ? linkAccount() : signIn())}
        >
          {busy ? 'Un momento…' : linking ? 'Collega l’email' : 'Entra'}
        </Button>

        {linking ? (
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={busy}
            className="mt-3 w-full text-sm text-muted underline decoration-line underline-offset-4"
          >
            Ho già un account: entra
          </button>
        ) : null}

        {message ? <p className="mt-3 text-sm text-accent">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>

      {linking ? (
        <p className="text-xs text-muted">
          Entrando in un account già esistente lasci indietro quello che hai salvato in questa
          sessione anonima: collega l’email, invece, se vuoi portartelo dietro.
        </p>
      ) : null}
    </div>
  );
}
