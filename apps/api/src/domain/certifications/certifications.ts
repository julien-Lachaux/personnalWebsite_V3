/** Certification publiée, `name` déjà dans la langue demandée (repli `fr` fait par le dépôt). */
export interface Certification {
  slug: string;
  issuer: string;
  year: number;
  url: string | null;
  name: string;
}
