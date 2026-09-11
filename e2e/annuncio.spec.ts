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

  await page.getByLabel('Link dell’annuncio').fill(ANNUNCIO);
  await page.getByRole('button', { name: 'Guarda' }).click();

  // Cosa dice l'annuncio arriva molto prima dell'identificazione: e' gia'
  // abbastanza per sapere che abbiamo aperto la pagina giusta.
  await expect(page.getByText('Cosa dice l’annuncio')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(/The North Face/).first()).toBeVisible();

  // Il prezzo dell'annuncio e' quello che il verdetto deve giudicare.
  await expect(page.getByText('75 €').first()).toBeVisible();

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
});
