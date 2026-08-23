/**
 * Accesso alle API eBay.
 *
 * Esiste per togliere il modello dal mezzo quando i prezzi si possono avere
 * direttamente: una ricerca agentica sul web costava circa 300.000 token di
 * input per analisi, mentre qui la stessa informazione arriva strutturata da
 * una chiamata HTTP. Il modello resta dove serve davvero, cioe' a riconoscere
 * l'oggetto nelle foto.
 */

const HOSTS = {
  sandbox: 'https://api.sandbox.ebay.com',
  production: 'https://api.ebay.com',
} as const;

export type EbayEnvironment = keyof typeof HOSTS;

export type EbayConfig = {
  clientId: string;
  clientSecret: string;
  environment: EbayEnvironment;
};

/** Null quando non e' configurato: la ricerca ricade sul modello, senza rompersi. */
export function getEbayConfig(): EbayConfig | null {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const environment: EbayEnvironment =
    process.env.EBAY_ENV === 'production' ? 'production' : 'sandbox';
  return { clientId, clientSecret, environment };
}

type CachedToken = { value: string; expiresAt: number };

let cached: CachedToken | null = null;

/** Un minuto di margine: un token scaduto a meta' richiesta costa un errore inutile. */
const EXPIRY_MARGIN_MS = 60_000;

export class EbayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EbayError';
  }
}

/**
 * Token applicativo (client credentials): identifica l'applicazione, non un
 * utente, quindi non tocca nessun account. Dura due ore e viene riusato:
 * richiederne uno a ogni ricerca sarebbe una chiamata in piu' per niente.
 */
export async function getApplicationToken(config: EbayConfig): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) return cached.value;

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch(`${HOSTS[config.environment]}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  if (!response.ok) {
    throw new EbayError(
      `Autenticazione eBay fallita (${response.status})`,
      response.status,
    );
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new EbayError('eBay non ha restituito un token');

  cached = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 7200) * 1000,
  };
  return cached.value;
}

export function ebayHost(config: EbayConfig): string {
  return HOSTS[config.environment];
}

/** Solo per i test: azzera il token memorizzato. */
export function resetTokenCache(): void {
  cached = null;
}
