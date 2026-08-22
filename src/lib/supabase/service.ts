import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

let client: SupabaseClient | null = null;

/**
 * Client con la chiave di servizio: salta la RLS.
 *
 * Serve unicamente alla cache delle ricerche di mercato, che e' una tabella
 * senza policy e quindi irraggiungibile in altro modo. `server-only` in cima
 * fa fallire la build se qualcuno lo importa da un componente client: quella
 * chiave nel browser darebbe a chiunque accesso completo al database.
 *
 * Null quando la chiave non e' configurata: la cache si spegne da sola e
 * l'analisi continua a funzionare pagando ogni ricerca, invece di rompersi.
 */
export function getServiceSupabase(): SupabaseClient | null {
  if (client) return client;

  const env = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) return null;

  client = createClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
