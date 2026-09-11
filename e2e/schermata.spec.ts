import path from 'node:path';
import { test } from '@playwright/test';

/**
 * Non un test: uno strumento per guardare la pagina risultato com'e' davvero,
 * su uno schermo da telefono. Le decisioni su cosa tagliare e come scrivere si
 * prendono guardando, non immaginando.
 *
 *   npm run schermate
 *   → e2e/schermate/risultato.png (intera) e schermo-0..4.png (a schermate)
 */
test.use({ viewport: { width: 390, height: 844 } });

test('@istantanea la home', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'e2e/schermate/home.png', fullPage: true });
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate((n) => window.scrollTo(0, n * 700), i);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `e2e/schermate/home-${i}.png` });
  }
});

test('@istantanea l’attesa dell’analisi', async ({ page }) => {
  await page.goto('/analizza');
  await page.locator('input[type="file"]').setInputFiles(
    path.join(process.cwd(), 'bench', 'photos', 'olivetti-valentine.jpg'),
  );
  await page.getByRole('button', { name: 'Analizza', exact: true }).click();
  // Appena parte: primo passo in corso, gli altri spenti.
  await page.getByText('Ci sto lavorando').waitFor({ timeout: 30_000 });
  await page.screenshot({ path: 'e2e/schermate/attesa-1.png' });
  // A oggetto riconosciuto: primo passo spuntato, secondo in corso.
  await page.getByText('Cerco sul mercato').waitFor();
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: 'e2e/schermate/attesa-2.png' });
});

test('@istantanea gli scheletri', async ({ page }) => {
  // Il throttling rallenta la risposta del server quanto basta a vedere il
  // fallback che di solito passa in un lampo.
  const sessione = await page.context().newCDPSession(page);
  await sessione.send('Network.enable');
  await sessione.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 1_200,
    downloadThroughput: 200_000,
    uploadThroughput: 200_000,
  });

  await page.goto('/inventario', { waitUntil: 'commit' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'e2e/schermate/scheletro-inventario.png' });
});

test('@istantanea la pagina risultato', async ({ page }) => {
  await page.goto('/analizza');
  await page.locator('input[type="file"]').setInputFiles(
    path.join(process.cwd(), 'bench', 'photos', 'olivetti-valentine.jpg'),
  );
  await page.getByRole('button', { name: 'Analizza', exact: true }).click();
  await page.getByText('Quanto costa', { exact: true }).first().waitFor({ timeout: 150_000 });
  await page.getByLabel('Prezzo richiesto dal venditore').fill('30');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'e2e/schermate/risultato.png', fullPage: true });

  // Anche a schermate, come le vede chi scorre col pollice.
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate((n) => window.scrollTo(0, n * 700), i);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `e2e/schermate/schermo-${i}.png` });
  }
});
