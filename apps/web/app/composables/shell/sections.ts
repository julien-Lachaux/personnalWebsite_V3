// Les quatre sections du site (SPEC § 2) telles que la coquille les présente : ordre des onglets,
// nom de fichier affiché dans l'en-tête mobile. Les noms de fichier ne se traduisent pas.
import { TILE_ORDER } from '../../domain/layout.js';
import type { TileId } from '../../domain/layout-types.js';

/** Identifiant d'une section : le même que celui d'une tuile de la mosaïque (`domain/layout`). */
export type SectionId = TileId;

/** Ordre des onglets (Profil, XP, Recos, IA), identique à celui des tuiles. */
export const SECTION_IDS: readonly SectionId[] = TILE_ORDER;

/** Fichier affiché pour chaque section (SPEC § 2). */
export const SECTION_FILES: Record<SectionId, string> = {
  profile: 'profil.cv',
  experience: 'experience.log',
  recommendations: 'recommandations.md',
  ai: 'ia.md',
};

/** Nom du site dans les barres du haut (`>_ julien-lachaux`). */
export const SITE_HANDLE = 'julien-lachaux';
