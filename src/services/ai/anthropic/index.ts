import type Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { IdentificationSchema, type Identification } from '@/schemas/identification';
import { MarketResearchSchema, type MarketResearch } from '@/schemas/market';
import { toStrictToolSchema } from '@/lib/json-schema';
import { aiConfig, type ResearchLane } from '../config';
import { mergeMarketResearch } from '../merge';
import { UsageMeter, describeUsage, type UsageTotals } from '../usage';
import {
  ProviderError,
  type IdentificationOutcome,
  type ImageInput,
  type MarketResearchOutcome,
  type ObjectIntelligenceProvider,
  type ResearchOptions,
} from '../provider';
import { getAnthropicClient } from './client';
import { IDENTIFICATION_SYSTEM_PROMPT, researchSystemPrompt } from './prompts';

const REPORT_TOOL_NAME = 'report_market_research';

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof APIError) {
    if (error.status === 429) {
      return new ProviderError('Troppe richieste al modello', 'rate_limited', { cause: error });
    }
    if (error.status === 401 || error.status === 403) {
      return new ProviderError('Credenziali del modello non valide', 'missing_credentials', {
        cause: error,
      });
    }
    if (error.status !== undefined && error.status >= 500) {
      return new ProviderError('Il modello non e’ raggiungibile', 'unavailable', { cause: error });
    }
  }
  return new ProviderError('Errore inatteso durante l’analisi', 'unknown', { cause: error });
}

function identificationBrief(identification: Identification): string {
  const lines = [
    `Oggetto: ${identification.name}`,
    `Categoria: ${identification.category}`,
    `Marca: ${identification.brand ?? 'non identificata'}`,
    `Modello: ${identification.model ?? 'non identificato'}`,
    `Epoca stimata: ${identification.period ?? 'non determinata'}`,
    `Materiali: ${identification.materials.join(', ') || 'non specificati'}`,
    `Caratteristiche: ${identification.characteristics.join('; ') || 'nessuna'}`,
    `Marchi letti sulle foto: ${identification.markings.join('; ') || 'nessuno'}`,
    `Stato: ${identification.condition}${
      identification.conditionNotes.length ? ` (${identification.conditionNotes.join('; ')})` : ''
    }`,
    `Confidenza sull’identificazione: ${identification.confidence.toFixed(2)}`,
  ];

  if (identification.searchQueries.length > 0) {
    lines.push(`Query suggerite: ${identification.searchQueries.join(' | ')}`);
  }

  return lines.join('\n');
}

export class AnthropicProvider implements ObjectIntelligenceProvider {
  async identify(images: ImageInput[]): Promise<IdentificationOutcome> {
    if (images.length === 0) {
      throw new ProviderError('Nessuna immagine da analizzare', 'invalid_response');
    }

    const client = getAnthropicClient();

    try {
      const response = await client.messages.parse({
        model: aiConfig.identification.model,
        max_tokens: aiConfig.identification.maxTokens,
        system: IDENTIFICATION_SYSTEM_PROMPT,
        output_config: {
          effort: aiConfig.identification.effort,
          format: zodOutputFormat(IdentificationSchema),
        },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((image, index) => [
                {
                  type: 'text' as const,
                  text: `Foto ${index + 1} di ${images.length}`,
                },
                {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: image.mediaType,
                    data: image.data,
                  },
                },
              ]),
              { type: 'text' as const, text: 'Identifica questo oggetto.' },
            ].flat(),
          },
        ],
      });

      const meter = new UsageMeter();
      meter.add(aiConfig.identification.model, response.usage);
      console.info(describeUsage('identificazione', meter.totals));

      if (response.stop_reason === 'refusal') {
        throw new ProviderError('Il modello ha rifiutato di analizzare queste immagini', 'invalid_response');
      }
      if (!response.parsed_output) {
        throw new ProviderError('Il modello non ha restituito un’identificazione valida', 'invalid_response');
      }

      return { identification: response.parsed_output, usage: meter.totals };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  /**
   * Le corsie partono insieme: il tempo di attesa e' quello della piu' lenta,
   * non la somma. Se qualcuna cade si va avanti con le altre — meno dati sono
   * pur sempre dati, mentre un errore secco lascia l'utente senza niente.
   */
  async researchMarket(
    identification: Identification,
    options?: ResearchOptions,
  ): Promise<MarketResearchOutcome> {
    const client = getAnthropicClient();
    const brief = identificationBrief(identification);
    const lanes = options?.laneIds
      ? aiConfig.research.lanes.filter((lane) => options.laneIds!.includes(lane.id))
      : aiConfig.research.lanes;

    if (lanes.length === 0) {
      throw new ProviderError('Nessuna corsia di ricerca selezionata', 'unavailable');
    }

    const meter = new UsageMeter();

    const settled = await Promise.allSettled(
      lanes.map(async (lane) => {
        try {
          const { research, usage } = await this.#runLane(client, lane, brief);
          meter.merge(usage);
          options?.onLaneSettled?.({
            id: lane.id,
            label: lane.label,
            status: 'done',
            comparables: research.comparables.length,
          });
          return research;
        } catch (error) {
          options?.onLaneSettled?.({
            id: lane.id,
            label: lane.label,
            status: 'failed',
            comparables: 0,
          });
          throw error;
        }
      }),
    );

    const found: MarketResearch[] = [];
    const failedLabels: string[] = [];
    let firstFailure: unknown = null;

    settled.forEach((outcome, index) => {
      const lane = lanes[index]!;
      if (outcome.status === 'fulfilled') {
        found.push(outcome.value);
        return;
      }
      failedLabels.push(lane.label);
      firstFailure ??= outcome.reason;
      console.error(`[research] corsia "${lane.id}" fallita`, outcome.reason);
    });

    if (found.length === 0) {
      throw toProviderError(firstFailure ?? new ProviderError('La ricerca di mercato non ha prodotto risultati', 'unavailable'));
    }

    const warnings =
      failedLabels.length > 0
        ? [
            `Una parte della ricerca non e’ andata a buon fine (${failedLabels.join(
              ', ',
            )}): la stima poggia su meno dati del solito.`,
          ]
        : [];

    console.info(describeUsage(`ricerca (${found.length}/${lanes.length} corsie)`, meter.totals));

    return { research: mergeMarketResearch(found), warnings, usage: meter.totals };
  }

  async #runLane(
    client: Anthropic,
    lane: ResearchLane,
    brief: string,
  ): Promise<{ research: MarketResearch; usage: UsageTotals }> {
    const tools: Anthropic.ToolUnion[] = [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: lane.maxSearches,
        user_location: {
          type: 'approximate',
          country: aiConfig.market.country,
          timezone: aiConfig.market.timezone,
        },
      },
      {
        type: 'web_fetch_20260209',
        name: 'web_fetch',
        max_uses: lane.maxFetches,
        max_content_tokens: aiConfig.research.maxFetchContentTokens,
      },
      {
        name: REPORT_TOOL_NAME,
        description:
          'Consegna i comparabili trovati e la lettura del mercato. Chiamalo una sola volta, alla fine della ricerca.',
        strict: true,
        input_schema: toStrictToolSchema(MarketResearchSchema) as Anthropic.Tool['input_schema'],
      },
    ];

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Trova vendite comparabili per questo oggetto e riporta il mercato.\n\n${brief}`,
      },
    ];

    const meter = new UsageMeter();

    for (let iteration = 0; iteration < aiConfig.research.maxIterations; iteration += 1) {
      const response = await client.messages.create({
        model: aiConfig.research.model,
        max_tokens: aiConfig.research.maxTokens,
        system: researchSystemPrompt(lane.mandate),
        ...(aiConfig.research.effort === null
          ? {}
          : { output_config: { effort: aiConfig.research.effort } }),
        /**
         * Il loop rimanda ogni volta la conversazione intera, e i risultati di
         * ricerca ne sono la parte grossa. Senza cache il secondo giro ripaga
         * a prezzo pieno cio' che ha gia' pagato il primo; con la cache lo
         * rilegge a un decimo. Il marcatore si mette da solo sull'ultimo
         * blocco memorizzabile.
         */
        cache_control: { type: 'ephemeral' },
        tools,
        messages,
      });

      meter.add(aiConfig.research.model, response.usage);

      if (response.stop_reason === 'refusal') {
        throw new ProviderError('Il modello ha rifiutato la ricerca di mercato', 'invalid_response');
      }

      messages.push({ role: 'assistant', content: response.content });

      // Il loop dei tool server-side ha raggiunto il limite: si riprende re-inviando.
      if (response.stop_reason === 'pause_turn') continue;

      const report = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === 'tool_use' && block.name === REPORT_TOOL_NAME,
      );

      if (report) {
        const parsed = MarketResearchSchema.safeParse(report.input);
        if (!parsed.success) {
          throw new ProviderError('Risultati di mercato in un formato inatteso', 'invalid_response', {
            cause: parsed.error,
          });
        }
        return { research: parsed.data, usage: meter.totals };
      }

      messages.push({
        role: 'user',
        content: `Chiama ora ${REPORT_TOOL_NAME} con quello che hai trovato. Se non hai trovato comparabili credibili nel tuo mandato, chiamalo con comparables vuoto.`,
      });
    }

    throw new ProviderError('La ricerca di mercato non si e’ conclusa', 'unavailable');
  }
}
