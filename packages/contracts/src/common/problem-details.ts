import { z } from 'zod';

/**
 * Corps d'erreur au format RFC 9457 (« Problem Details for HTTP APIs »).
 * Servi avec le type de contenu `application/problem+json`.
 */
export const ProblemDetailsSchema = z
  .object({
    // `default` est une annotation du contrat (RFC 9457), pas une valeur injectée au parse :
    // l'API renvoie toujours `type`, le champ reste donc `required` dans le document OpenAPI.
    type: z.string().meta({
      description: 'URI identifiant le type de problème. `about:blank` = statut HTTP seul.',
      default: 'about:blank',
    }),
    title: z.string().meta({ description: 'Résumé court et stable du type de problème.' }),
    status: z.int().min(100).max(599).meta({ description: 'Code de statut HTTP.' }),
    detail: z.string().optional().meta({ description: 'Explication propre à cette occurrence.' }),
    instance: z.string().optional().meta({ description: 'URI de la requête concernée.' }),
  })
  .meta({ id: 'ProblemDetails' });

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';
