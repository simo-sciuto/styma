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
  await expect(page.getByRole('heading', { name: /Da dove partiamo/ })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(FOTO);
  const analizza = page.getByRole('button', { name: 'Analizza', exact: true });
  await expect(analizza).toBeEnabled();
  await analizza.click();

  // — L'identificazione arriva dalle risposte registrate, il mercato da eBay —
  await expect(page.getByText('Quanto costa', { exact: true })).toBeVisible({ timeout: 150_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Olivetti|Valentine/i);

  // — Si salva da sola, e l'indirizzo diventa il suo ————————————————
  //
  // L'indirizzo e' `/analizza?oggetto=<id>`: stessa rotta, parametro diverso.
  // Riscrivere il percorso verso `/inventario/<id>`, come si faceva prima,
  // convinceva il router App Router di stare su un'altra rotta, e la prima
  // azione server successiva — cioe' il primo carattere del prezzo qui sotto
  // — rigenerava quella, buttando via il risultato appena letto.
  await expect(page.getByText(/Salvato in inventario/)).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/analizza\?oggetto=[0-9a-f-]{36}$/, { timeout: 30_000 });
  itemId = new URL(page.url()).searchParams.get('oggetto')!;

  // — Il prezzo del banco produce un verdetto, senza tornare al server ——
  const prezzo = page.getByLabel('Prezzo richiesto dal venditore');

  await prezzo.fill('30');
  await expect(page.getByText(/^(Compralo|Tratta|Lascia stare)$/)).toBeVisible();

  // — E il verdetto resta li': la pagina non se ne va da sola ————————
  await page.waitForTimeout(3_000);
  await expect(page).toHaveURL(/\/analizza\?oggetto=/);
  await expect(page.getByText(/^(Compralo|Tratta|Lascia stare)$/)).toBeVisible();

  // — E sopravvive a una ricarica: e' il punto di tutta la fase F3 ————
  await attendiPrezzoScritto(itemId);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Olivetti|Valentine/i);
  await expect(page.getByLabel('Prezzo richiesto dal venditore')).toHaveValue('30');

  // — Dall'analisi alla scheda dell'oggetto, con un collegamento vero ——
  await page.getByRole('link', { name: /Registra com/ }).click();
  await expect(page).toHaveURL(new RegExp(`/inventario/${itemId}$`));

  // — L'ho comprato ————————————————————————————————————————————
  await expect(page.getByText('Che fine ha fatto')).toBeVisible();
  await page.getByRole('button', { name: 'Si’, l’ho comprato' }).click();

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
  // Il guadagno e' una sottrazione fra due cifre digitate qui sopra, e da
  // quando commissioni e spedizione sono uscite dai conti e' l'unico margine
  // che esiste: niente piu' "lordo" e "netto stimato" da confrontare.
  await expect(page.getByText('Guadagno', { exact: true })).toBeVisible();
  await expect(page.getByText('+65 €', { exact: true })).toBeVisible();
  // E il confronto con la fascia: l'unico punto in cui il prodotto puo'
  // essere smentito.
  await expect(page.getByText(/La stima diceva|avevamo sopravvalutato|avevamo sottovalutato/)).toBeVisible();

  // — Il magazzino ha registrato il fatto, non la previsione ——————————
  await page.goto('/inventario');
  await expect(page.getByText('Guadagnato davvero')).toBeVisible();
  await expect(page.getByText('Stime centrate')).toBeVisible();
  await expect(page.getByText('Venduto a 90 €')).toBeVisible();

  // — E l'andamento conta gli stessi soldi, non le stime ————————————
  //
  // Comprato a 25, venduto a 90: incassi 90, spendi 25, margine 65. Se questa
  // cifra un giorno divergesse da quella della scheda oggetto, due schermate
  // dello stesso prodotto direbbero due cose diverse sullo stesso oggetto.
  // Dal menu, che e' dove l'andamento vive adesso: prima era un collegamento
  // in fondo all'inventario, cioe' una pagina di passaggio obbligata.
  await page.getByRole('link', { name: 'Andamento' }).first().click();
  await expect(page).toHaveURL(/\/andamento$/);
  await expect(page.getByText('Hai guadagnato')).toBeVisible();
  // `.first()`: lo stesso margine compare anche nella classifica per
  // categoria qui sotto, che e' esattamente il blocco che deve esserci.
  await expect(page.getByText('+65 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('90 €', { exact: true })).toBeVisible();
  await expect(page.getByText('25 €', { exact: true })).toBeVisible();

  // — E le letture nuove: su cosa guadagni, e quanto gira ——————————
  await expect(page.getByText('Su cosa guadagni')).toBeVisible();
  await expect(page.getByText('Quanto gira')).toBeVisible();
  // Comprato uno, venduto uno: il magazzino e' girato tutto.
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'e2e/schermate/andamento.png', fullPage: true });

  // — Toglierlo dalla lista non lo cancella ————————————————————————
  await page.goto(`/inventario/${itemId}`);
  await page.getByRole('button', { name: 'Toglilo dalla lista' }).click();
  await expect(page.getByText(/Archiviato\. Non e’ in lista/)).toBeVisible({
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
