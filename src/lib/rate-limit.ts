import { getServiceSupabase } from './supabase/service';

type Bucket = { count: number; resetAt: number };
type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

const buckets = new Map<string, Bucket>();

/**
 * Limitatore in memoria: un solo processo, quindi va bene in sviluppo, dove
 * gira sempre lo stesso `npm run dev`. Su un'infrastruttura serverless ogni
 * richiesta puo' capitare su un'istanza diversa, ognuna con la propria Map
 * vuota: il limite smetterebbe di contare in silenzio, non con un errore.
 * E' per questo che in produzione si passa dalla versione su Postgres.
 */
function checkRateLimitInMemory(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Rate limit condiviso fra tutte le istanze, su una funzione Postgres
 * atomica: due richieste arrivate nello stesso istante su due istanze
 * diverse vengono serializzate a livello di riga, invece di leggere lo
 * stesso contatore e incrementarlo entrambe da capo.
 */
async function checkRateLimitPersisted(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_ms: windowMs })
    .single<{ allowed: boolean; retry_after_seconds: number }>();

  if (error || !data) {
    // Un limitatore che fallisce non deve poter bloccare l'analisi: si
    // ripiega sulla versione in memoria, che sull'istanza corrente conta
    // comunque qualcosa, invece di trasformare un errore di rete in un 429.
    console.warn('[rate-limit] Postgres non disponibile, ripiego sulla memoria locale', error);
    return null;
  }

  return { allowed: data.allowed, retryAfterSeconds: data.retry_after_seconds };
}

export async function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  return (await checkRateLimitPersisted(key, options)) ?? checkRateLimitInMemory(key, options);
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'local';
}
