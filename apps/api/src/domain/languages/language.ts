/** Niveau du Cadre européen commun de référence pour les langues (contrainte SQL `cefr_level`). */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** Langue parlée, déjà traduite dans la langue demandée. */
export interface Language {
  readonly slug: string;
  /** Code ISO 639-1 en minuscules. */
  readonly code: string;
  /** `null` pour la langue maternelle. */
  readonly cefrLevel: CefrLevel | null;
  readonly name: string;
  readonly levelLabel: string;
}
