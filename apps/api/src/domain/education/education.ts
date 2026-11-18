/**
 * Formation publiée, textes déjà dans la langue demandée (repli `fr` fait par le dépôt).
 * `yearEnd` null = en cours ; `description` est optionnelle en SQL.
 */
export interface Education {
  slug: string;
  institution: string;
  yearStart: number;
  yearEnd: number | null;
  url: string | null;
  title: string;
  description: string | null;
}
