import { z } from 'zod';

/** Réponse de `GET /health`. */
export const HealthResponseSchema = z
  .object({
    status: z.enum(['ok']).meta({ description: "`ok` dès que l'API répond." }),
    checks: z
      .object({
        database: z.enum(['up', 'down']).meta({ description: 'Résultat du ping PostgreSQL.' }),
      })
      .meta({ description: 'Détail des dépendances vérifiées.' }),
  })
  .meta({ id: 'HealthResponse' });

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
