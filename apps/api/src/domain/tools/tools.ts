/** Outil du quotidien publié, textes déjà dans la langue demandée (repli `fr` fait par le dépôt). */
export interface Tool {
  slug: string;
  url: string | null;
  iconPath: string | null;
  name: string;
  family: string;
  description: string;
}
