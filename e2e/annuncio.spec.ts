import { expect, test } from '@playwright/test';

/**
 * Da un link a un verdetto, in un browser vero.
 *
 * E' la porta d'ingresso che non passa da nessuna fotografia: la pagina di
 * Vinted, le sue foto, la nostra identificazione, la stima. Le cuciture sono
 * quattro e nessun test unitario ne tocca una.
 *
 * Non cancella niente perche' non salva niente: l'analisi si salva da sola
 * solo se la persistenza e' configurata, e in quel caso l'oggetto resta in
 * inventario come un'analisi qualunque.
 */
test.use({ viewport: { width: 390, height: 844 } });

const ANNUNCIO =
  'https://www.vinted.it/items/9961066353-borsetta-a-tracolla-the-north-face-base-camp-high-pile-mini';

test('@annuncio dal link di Vinted al verdetto', async ({ page }) => {
  await page.goto('/analizza');

  await page.getByLabel(/Link dell’annuncio/).fill(ANNUNCIO);
  await page.getByRole('button', { name: 'Analizza', exact: true }).click();

  // Cosa dice l'annuncio arriva molto prima dell'identificazione: e' gia'
  // abbastanza per sapere che abbiamo aperto la pagina giusta.
  await expect(page.getByText('Cosa dice l’annuncio')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(/The North Face/).first()).toBeVisible();

  /*
   * Il prezzo puo' esserci o no, e non dipende da noi.
   *
   * Vinted serve la stessa pagina in due versioni: una col JSON-LD, che porta
   * prezzo, marca e categoria, e una senza, che porta solo titolo e foto.
   * Misurato sullo stesso annuncio a un'ora di distanza. Quando manca, il
   * prezzo lo scrive chi guarda — e il campo vuoto e' la risposta giusta, non
   * un guasto.
   */
  await expect(
    page
      .getByText('75 €')
      .first()
      .or(page.getByText('Scrivi il prezzo e ti dico se conviene')),
  ).toBeVisible({ timeout: 150_000 });

  /*
   * E quando il prezzo c'e', finisce nel campo da solo.
   *
   * E' la cifra che il verdetto deve giudicare: chiederla a mano dopo averla
   * appena letta al posto di chi guarda sarebbe un modulo che fa ricopiare un
   * dato che ha gia'. Resta modificabile, perche' su Vinted si tratta come al
   * banco.
   */
  const prezzo = await page.getByLabel('Prezzo richiesto dal venditore').inputValue();
  const dichiarato = await page.getByText('75 €').first().count();
  if (dichiarato > 0) expect(prezzo).toBe('75');

  /*
   * E la stima gira come per una foto scattata al banco. Le risposte valide
   * sono due, e la seconda non e' un fallimento: su un oggetto di cui non
   * leggiamo il modello, «non lo sappiamo» e' la risposta giusta, ed e' la
   * regola piu' vecchia di questo prodotto. Il test verifica che si arrivi a
   * una delle due, non che ne esca una fascia per forza.
   */
  await expect(
    page.getByText('Quanto vale', { exact: true }).or(page.getByText('Non sappiamo dirti quanto vale')),
  ).toBeVisible({ timeout: 150_000 });

  await page.screenshot({ path: 'e2e/schermate/annuncio.png', fullPage: true });

  /*
   * E le foto devono finire nel magazzino, non restare su Vinted.
   *
   * Un'analisi nata da un link non passa da nessun file scelto a mano: senza
   * l'importazione, l'oggetto salvato resterebbe senza copertina in lista e
   * senza immagine nella scheda. Il difetto non si vede sul risultato appena
   * fatto — li' le foto dell'annuncio si vedono dal vivo — si vedrebbe
   * domani, con l'inventario pieno di rettangoli grigi.
   */
  await expect(page.getByText(/Salvato in inventario/)).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/analizza\?oggetto=[0-9a-f-]{36}/, { timeout: 30_000 });
  const itemId = new URL(page.url()).searchParams.get('oggetto')!;

  // L'importazione gira dopo il salvataggio: si aspetta il fatto.
  await expect(async () => {
    await page.goto(`/inventario/${itemId}`);
    await expect(page.locator('main img').first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  /*
   * `naturalWidth`, non `toBeVisible`: un `<img>` con la sorgente rotta e'
   * visibile lo stesso, e la prima versione di questo test passava mostrando
   * un rettangolo grigio. La domanda e' se il pixel c'e'.
   */
  /*
   * E l'indirizzo dell'annuncio sopravvive al salvataggio.
   *
   * Prima no: la scheda del confronto vive nello stato del browser, e riaperto
   * l'oggetto non restava niente. Ma «quella borsa e' ancora in vendita? a
   * quanto sta adesso?» e' proprio la domanda di chi riapre fra un mese.
   */
  await expect(page.getByRole('link', { name: /Riaprilo su Vinted/ })).toHaveAttribute(
    'href',
    new RegExp('vinted\\.it/items/9961066353'),
  );

  await page.goto('/inventario');
  await expect
    .poll(
      () =>
        page
          .locator('main img')
          .first()
          .evaluate((img: HTMLImageElement) => img.naturalWidth)
          .catch(() => 0),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'e2e/schermate/annuncio-inventario.png', fullPage: true });

  // Pulizia: l'oggetto creato qui non deve restare in magazzino.
  const env = Object.fromEntries(
    (await import('node:fs')).readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
  const risposta = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/items?id=eq.${itemId}`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  console.log(`[e2e] oggetto ${itemId} cancellato: ${risposta.status}`);
});
