import * as z from 'zod/v4';

/**
 * Converte uno schema Zod nel JSON Schema accettato da `input_schema`
 * con `strict: true`. Zod v4 genera gia' `additionalProperties: false`
 * e `required` completo; va solo rimosso il campo `$schema`.
 */
export function toStrictToolSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}
