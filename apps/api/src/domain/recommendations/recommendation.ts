/** Langue d'une ligne de traduction (type `locale_code` en base). */
export type ContentLocale = 'fr' | 'en';

/** Recommandation professionnelle publiée, dans la langue de la ligne de traduction servie. */
export interface Recommendation {
  readonly slug: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly relationship: string;
  /** Date `YYYY-MM-DD`. */
  readonly recommendedOn: string;
  /** Citation, un paragraphe par élément. */
  readonly paragraphs: readonly string[];
  /** Langue de la ligne servie : `fr` quand la ligne demandée n'existe pas (repli par ligne). */
  readonly locale: ContentLocale;
}
