import type Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { IdentificationSchema, type Identification } from '@/schemas/identification';
import { MarketResearchSchema, type MarketResearch } from '@/schemas/market';
import { toStrictToolSchema } from '@/lib/json-schema';
import { aiConfig } from '../config';
import { ProviderError, type ImageInput, type ObjectIntelligenceProvider } from '../provider';
import { getAnthropicClient } from './client';
import { IDENTIFICATION_SYSTEM_PROMPT, RESEARCH_SYSTEM_PROMPT } from './prompts';

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
  async identify(images: ImageInput[]): Promise<Identification> {
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

      if (response.stop_reason === 'refusal') {
        throw new ProviderError('Il modello ha rifiutato di analizzare queste immagini', 'invalid_response');
      }
      if (!response.parsed_output) {
        throw new ProviderError('Il modello non ha restituito un’identificazione valida', 'invalid_response');
      }

      return response.parsed_output;
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async researchMarket(identification: Identification): Promise<MarketResearch> {
    const client = getAnthropicClient();

    const tools: Anthropic.ToolUnion[] = [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: aiConfig.research.maxSearches,
        user_location: {
          type: 'approximate',
          country: aiConfig.market.country,
          timezone: aiConfig.market.timezone,
        },
      },
      {
        type: 'web_fetch_20260209',
        name: 'web_fetch',
        max_uses: aiConfig.research.maxSearches,
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
        content: `Trova vendite comparabili per questo oggetto e riporta il mercato.\n\n${identificationBrief(
          identification,
        )}`,
      },
    ];

    try {
      for (let iteration = 0; iteration < aiConfig.research.maxIterations; iteration += 1) {
        const response = await client.messages.create({
          model: aiConfig.research.model,
          max_tokens: aiConfig.research.maxTokens,
          system: RESEARCH_SYSTEM_PROMPT,
          output_config: { effort: aiConfig.research.effort },
          tools,
          messages,
        });

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
          return parsed.data;
        }

        messages.push({
          role: 'user',
          content: `Chiama ora ${REPORT_TOOL_NAME} con quello che hai trovato. Se non hai trovato comparabili credibili, chiamalo con comparables vuoto.`,
        });
      }

      throw new ProviderError('La ricerca di mercato non si e’ conclusa', 'unavailable');
    } catch (error) {
      throw toProviderError(error);
    }
  }
}
