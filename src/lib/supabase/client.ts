'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Null quando la persistenza non e' configurata: l'analisi funziona lo stesso. */
export function getBrowserSupabase() {
  const env = getSupabaseEnv();
  if (!env) return null;
  client ??= createBrowserClient(env.url, env.anonKey);
  return client;
}

/**
 * Identita' senza attrito: in mercatino nessuno si registra. L'utente riceve
 * una sessione anonima al primo salvataggio; potra' collegarla a un'email dopo.
 */
export async function ensureSession() {
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error('Persistenza non configurata');

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) {
    throw new Error(
      'Non riusciamo a creare una sessione. Verifica che gli accessi anonimi siano attivi su Supabase.',
    );
  }
  return signedIn.user.id;
}
