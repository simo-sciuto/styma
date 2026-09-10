import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Il giro che nessun test unitario tocca: fotografia → analisi → indirizzo →
 * esito reale → archivio.
 *
 * Ogni passo qui e' una cucitura fra due mondi. L'analisi vive nel browser, il
 * salvataggio in un'azione server, la sessione anonima nasce da sola al primo
 * salvataggio, l'indirizzo cambia senza navigare, e chi ricarica legge lo
 * snapshot da un processo diverso da quello che l'ha scritto. Sono i punti in
 * cui `vitest` non arriva, ed e' li' che si e' rotto tutto finora.
 */

const FOTO = path.join(process.cwd(), 'bench', 'photos', 'olivetti-valentine.jpg');

/** Le credenziali di servizio, per guardare e ripulire il database dal test. */
function supabaseEnv() {
  const env = Object.fromEntries(
    readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
  );
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

/**
 * Aspetta che il prezzo digitato sia davvero nel database.
 *
 * Non e' pignoleria: la scrittura parte 900 ms dopo l'ultimo tasto e viene
 * annullata se la pagina si smonta prima. Un robot che digita e ricarica in
 * duecento millisecondi la cancella ogni volta — e una volta ricaricata la
 * pagina, il valore digitato non esiste piu' da nessuna parte, quindi
 * riprovare l'asserzione non serve a niente. Si aspetta il fatto, poi si
 * guarda la pagina.
 */
async function attendiPrezzoScritto(itemId: string): Promise<void> {
  const { url, key } = supabaseEnv();
  const scadenza = Date.now() + 15_000;

  while (Date.now() < scadenza) {
    const response = await fetch(`${url}/rest/v1/items?id=eq.${itemId}&select=asking_price`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const [row] = (await response.json()) as { asking_price: string | null }[];
    if (row?.asking_price !== null && row?.asking_price !== undefined) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`il prezzo non e' mai arrivato nel database per ${itemId}`);
}

/** L'oggetto creato dal test, per cancellarlo alla fine. */
let itemId: string | null = null;

test.describe.configure({ mode: 'serial' });

test('dall’analisi all’archivio, passando per la vendita', async ({ page }) => {
  const erroriConsole: string[] = [];
  page.on('pageerror', (error) => erroriConsole.push(error.message));

  // — Si comincia da una foto ————————————————————————————————————
  await page.goto('/analizza');
  await expect(page.getByRole('heading', { name: /Fotografa l/ })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(FOTO);
  const analizza = page.getByRole('button', { name: 'Analizza', exact: true });
  await expect(analizza).toBeEnabled();
  await analizza.click();

  // — L'identificazione arriva dalle risposte registrate, il mercato da eBay —
  await expect(page.getByText('Identificato')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Olivetti|Valentine/i);

  // — Si salva da sola, e l'indirizzo diventa il suo ————————————————
  await expect(page.getByText(/Salvato in inventario/)).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/inventario\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  itemId = new URL(page.url()).pathname.split('/').pop()!;

  // — Il prezzo del banco produce un verdetto, senza tornare al server ——
  const prezzo = page.getByLabel('Prezzo richiesto dal venditore');

  await prezzo.fill('30');
  await expect(page.getByText(/^(Compralo|Tratta|Lascia stare)$/)).toBeVisible();

  // — E sopravvive a una ricarica: e' il punto di tutta la fase F3 ————
  await attendiPrezzoScritto(itemId);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Olivetti|Valentine/i);
  await expect(page.getByLabel('Prezzo richiesto dal venditore')).toHaveValue('30');

  // — L'ho comprato ————————————————————————————————————————————
  await expect(page.getByText('Com’e’ andata')).toBeVisible();
  await page.getByRole('button', { name: 'L’ho comprato' }).click();

  await page.getByLabel('Quanto hai pagato davvero').fill('25');
  // Chiedevano 30, hai pagato 25: la trattativa si dichiara mentre scrivi.
  await expect(page.getByText(/in meno di quanto chiedevano/)).toBeVisible();
  await page.getByRole('button', { name: 'Registra' }).click();

  await expect(page.getByText('Ce l’hai in magazzino')).toBeVisible({ timeout: 30_000 });
  // `exact`: "Pagato" da solo pesca anche "Quanto hai pagato" nel conto del flip.
  await expect(page.getByText('Pagato', { exact: true })).toBeVisible();
  await expect(page.getByText('Trattato', { exact: true })).toBeVisible();

  // — L'ho venduto ————————————————————————————————————————————
  await page.getByRole('button', { name: 'L’ho venduto' }).click();
  await page.getByLabel('A quanto l’hai venduto').fill('90');
  await page.getByLabel('Su quale piattaforma').fill('Vinted');
  await page.getByRole('button', { name: 'Registra' }).click();

  await expect(page.getByText('Venduto su Vinted')).toBeVisible({ timeout: 30_000 });
  // Il margine lordo e' una sottrazione fra due cifre digitate qui sopra.
  // `exact` di nuovo: la nota sotto il conto spiega cos'e' "la differenza".
  await expect(page.getByText('Differenza', { exact: true })).toBeVisible();
  await expect(page.getByText('+65 €', { exact: true })).toBeVisible();
  // E il confronto con la fascia: l'unico punto in cui il prodotto puo'
  // essere smentito.
  await expect(page.getByText(/La stima diceva|avevamo sopravvalutato|avevamo sottovalutato/)).toBeVisible();

  // — Il magazzino ha registrato il fatto, non la previsione ——————————
  await page.goto('/inventario');
  await expect(page.getByText('Guadagnato davvero')).toBeVisible();
  await expect(page.getByText('Stime centrate')).toBeVisible();
  await expect(page.getByText('Venduto a 90 €')).toBeVisible();

  // — Toglierlo dalla lista non lo cancella ————————————————————————
  await page.goto(`/inventario/${itemId}`);
  await page.getByRole('button', { name: 'Toglilo dalla lista' }).click();
  await expect(page.getByText(/Archiviato: non compare nella lista/)).toBeVisible({
    timeout: 30_000,
  });

  await page.goto('/inventario');
  // L'oggetto sparisce dalla lista, ma quanti sono gli archiviati si dice
  // sempre — con la lista piena come con la lista vuota, che qui e' il caso:
  // e' l'unico punto da cui si potrebbe restare senza una strada per tornare
  // a prenderli.
  await expect(page.getByText(/archiviat/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mostrali' })).toBeVisible();
  await expect(page.getByText('Venduto a 90 €')).toHaveCount(0);

  // E riaprendoli, c'e'.
  await page.getByRole('link', { name: 'Mostrali' }).click();
  await expect(page.getByText('Archiviato', { exact: true })).toBeVisible();

  expect(erroriConsole, `errori JavaScript in pagina: ${erroriConsole.join(' | ')}`).toEqual([]);
});

/**
 * Il test scrive su Supabase vero: senza pulizia, ogni esecuzione lascerebbe
 * un oggetto finto nell'inventario di chi lo lancia.
 */
test.afterAll(async () => {
  if (!itemId) return;

  const { url, key } = supabaseEnv();
  if (!url || !key) {
    console.warn(`[e2e] oggetto ${itemId} non cancellato: manca la chiave di servizio`);
    return;
  }

  const response = await fetch(`${url}/rest/v1/items?id=eq.${itemId}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.info(`[e2e] oggetto ${itemId} cancellato: ${response.status}`);
});
