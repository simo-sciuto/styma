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

test('@istantanea la pagina risultato', async ({ page }) => {
  await page.goto('/analizza');
  await page.locator('input[type="file"]').setInputFiles(
    path.join(process.cwd(), 'bench', 'photos', 'olivetti-valentine.jpg'),
  );
  await page.getByRole('button', { name: 'Analizza', exact: true }).click();
  await page.getByText('Identificato').first().waitFor({ timeout: 150_000 });
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
