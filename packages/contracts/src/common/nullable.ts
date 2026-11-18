import { z } from 'zod';

/**
 * Rend un schéma nullable en `schema | null` (champ toujours présent, valeur `null` permise).
 *
 * À utiliser à la place de `.nullable()` sur tout schéma qui porte un `id` : le générateur
 * OpenAPI propage sinon le `null` dans le composant partagé (`components.schemas.Image`
 * deviendrait nullable partout). Ici il émet un `anyOf: [{ $ref }, { type: 'null' }]` exact.
 * Pour un schéma sans `id` (chaîne, entier…), `.nullable()` reste correct.
 */
export const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);
