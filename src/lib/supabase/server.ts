import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

/**
 * Client lato server legato ai cookie della richiesta: vede la stessa
 * sessione anonima creata nel browser, quindi la RLS si applica normalmente.
 */
export async function getServerSupabase() {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // In un Server Component i cookie sono in sola lettura: la sessione
          // viene comunque rinfrescata dal middleware.
        }
      },
    },
  });
}
