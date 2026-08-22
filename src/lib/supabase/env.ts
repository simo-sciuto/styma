/**
 * Le variabili Supabase sono lette a runtime, mai a livello di modulo:
 * `next build` valuta le route senza ambiente e fallirebbe.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isPersistenceEnabled() {
  return getSupabaseEnv() !== null;
}
