import { defineConfig } from '@playwright/test';

/**
 * Il giro completo, con un browser vero.
 *
 * I test unitari coprono l'aritmetica; questo copre le cuciture, che sono
 * esattamente il posto dove finora si e' rotto tutto: la sessione anonima che
 * nasce al primo salvataggio, l'indirizzo che cambia senza navigare, lo
 * snapshot riletto da un altro processo, un'azione server chiamata da un
 * bottone. Nessuna di queste cose si vede da `vitest`.
 *
 * `channel: 'chrome'` e non il Chromium di Playwright: questa macchina gira su
 * macOS 12, che Playwright non supporta piu' per i browser scaricati. Il Chrome
 * installato va bene lo stesso, e in piu' e' il browser vero.
 */
export default defineConfig({
  testDir: './e2e',
  // Le istantanee non sono un test: non asseriscono niente, scrivono immagini
  // e costano venti secondi. Si lanciano a mano quando si tocca la pagina:
  //   npx playwright test e2e/schermata.spec.ts
  testIgnore: ['**/schermata.spec.ts'],
  // Il flusso scrive su un database condiviso: in parallelo si darebbero
  // fastidio a vicenda per guadagnare pochi secondi.
  workers: 1,
  fullyParallel: false,
  // Un e2e che riprova da solo nasconde proprio le rotture intermittenti che
  // dovrebbe trovare. Se fallisce, e' un'informazione.
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      // L'identificazione si rigioca dalle risposte registrate: un e2e che
      // paga il modello a ogni esecuzione non lo lancia piu' nessuno. La
      // ricerca di mercato resta vera — eBay non si paga, e le cuciture con
      // una fonte esterna sono proprio cio' che va provato.
      STYMA_AI_FIXTURES: '1',
    },
  },
});
