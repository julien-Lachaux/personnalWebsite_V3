import { type Image } from '@siteperso/contracts';

/**
 * Une image n'est exposée que si son chemin ET son texte alternatif existent et ne sont pas vides :
 * le contrat (`Image`) impose l'alternative pour l'accessibilité. Une valeur nulle ou vide (les
 * colonnes SQL sont nullables) donne `null` plutôt qu'une réponse invalide et un 500.
 */
export function toImage(path: string | null, alt: string | null): Image | null {
  return path !== null && path !== '' && alt !== null && alt !== '' ? { path, alt } : null;
}
