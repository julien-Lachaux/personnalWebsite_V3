import { expect } from 'vitest';
import { type z } from 'zod';

/**
 * Validation stricte d'un corps de réponse : le schéma Zod doit accepter le corps ET la valeur
 * parsée doit lui être strictement égale. Un schéma `z.object` qui retire silencieusement les
 * clés inconnues, ou une valeur transformée, fait donc échouer le test (pas de fuite tolérée).
 */
export function validate<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    expect.fail(`Corps non conforme au schéma :\n${JSON.stringify(result.error.issues, null, 2)}`);
  }
  expect(result.data).toStrictEqual(body);
  return result.data;
}
