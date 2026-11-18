/**
 * Ressource recommandée publiée (ex-favori), textes déjà dans la langue demandée (repli `fr` fait
 * par le dépôt). `groupSlug` est le slug du groupe de compétences rattaché, `null` sans groupe.
 */
export interface Resource {
  slug: string;
  url: string;
  groupSlug: string | null;
  picturePath: string | null;
  pictureAlt: string | null;
  name: string;
  description: string;
}
