import type Anthropic from '@anthropic-ai/sdk';

import { aiConfig } from './config';

/**
 * Consumo di una singola chiamata, gia' tradotto in costo.
 *
 * Serve perche' il conto di un'analisi non e' leggibile a occhio: i risultati
 * di ricerca rientrano come token di input a ogni giro, quindi la spesa cresce
 * dove non si vede. Senza questo numero si ottimizza a sentimento.
 */
export type CallUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  webSearches: number;
  webFetches: number;
  usd: number;
};

export type UsageTotals = Omit<CallUsage, 'model'> & { calls: number };

const EMPTY: UsageTotals = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  thinkingTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  webSearches: 0,
  webFetches: 0,
  usd: 0,
};

function priceFor(model: string) {
  return (
    aiConfig.pricing.models[model as keyof typeof aiConfig.pricing.models] ?? {
      inputPerMTok: 0,
      outputPerMTok: 0,
    }
  );
}

export function measure(model: string, usage: Anthropic.Usage): CallUsage {
  const { inputPerMTok, outputPerMTok } = priceFor(model);
  const { cacheWriteMultiplier, cacheReadMultiplier, webSearchUsd } = aiConfig.pricing;

  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const webSearches = usage.server_tool_use?.web_search_requests ?? 0;
  const webFetches = usage.server_tool_use?.web_fetch_requests ?? 0;

  const usd =
    (usage.input_tokens * inputPerMTok) / 1_000_000 +
    (usage.output_tokens * outputPerMTok) / 1_000_000 +
    (cacheWriteTokens * inputPerMTok * cacheWriteMultiplier) / 1_000_000 +
    (cacheReadTokens * inputPerMTok * cacheReadMultiplier) / 1_000_000 +
    // web_fetch non ha costo per richiesta: si paga solo il testo che porta dentro.
    webSearches * webSearchUsd;

  return {
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    thinkingTokens: usage.output_tokens_details?.thinking_tokens ?? 0,
    cacheWriteTokens,
    cacheReadTokens,
    webSearches,
    webFetches,
    usd,
  };
}

/**
 * Accumulatore per una singola analisi. Non e' condiviso fra richieste:
 * un totale globale in memoria mescolerebbe utenti diversi e mentirebbe
 * appena il processo si sdoppia.
 */
export class UsageMeter {
  #totals: UsageTotals = { ...EMPTY };

  add(model: string, usage: Anthropic.Usage | null | undefined): void {
    if (!usage) return;
    const call = measure(model, usage);
    this.#totals = {
      calls: this.#totals.calls + 1,
      inputTokens: this.#totals.inputTokens + call.inputTokens,
      outputTokens: this.#totals.outputTokens + call.outputTokens,
      thinkingTokens: this.#totals.thinkingTokens + call.thinkingTokens,
      cacheWriteTokens: this.#totals.cacheWriteTokens + call.cacheWriteTokens,
      cacheReadTokens: this.#totals.cacheReadTokens + call.cacheReadTokens,
      webSearches: this.#totals.webSearches + call.webSearches,
      webFetches: this.#totals.webFetches + call.webFetches,
      usd: this.#totals.usd + call.usd,
    };
  }

  merge(other: UsageTotals): void {
    this.#totals = {
      calls: this.#totals.calls + other.calls,
      inputTokens: this.#totals.inputTokens + other.inputTokens,
      outputTokens: this.#totals.outputTokens + other.outputTokens,
      thinkingTokens: this.#totals.thinkingTokens + other.thinkingTokens,
      cacheWriteTokens: this.#totals.cacheWriteTokens + other.cacheWriteTokens,
      cacheReadTokens: this.#totals.cacheReadTokens + other.cacheReadTokens,
      webSearches: this.#totals.webSearches + other.webSearches,
      webFetches: this.#totals.webFetches + other.webFetches,
      usd: this.#totals.usd + other.usd,
    };
  }

  get totals(): UsageTotals {
    return { ...this.#totals };
  }
}

/** Riga di log leggibile: il costo davanti, perche' e' quello che si guarda. */
export function describeUsage(label: string, totals: UsageTotals): string {
  return [
    `[usage] ${label}`,
    `$${totals.usd.toFixed(4)}`,
    `${totals.calls} chiamate`,
    `in ${totals.inputTokens.toLocaleString('it-IT')}`,
    `out ${totals.outputTokens.toLocaleString('it-IT')} (${totals.thinkingTokens.toLocaleString('it-IT')} di ragionamento)`,
    `cache w${totals.cacheWriteTokens.toLocaleString('it-IT')}/r${totals.cacheReadTokens.toLocaleString('it-IT')}`,
    `${totals.webSearches} ricerche, ${totals.webFetches} fetch`,
  ].join(' · ');
}
