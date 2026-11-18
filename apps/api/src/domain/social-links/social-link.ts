/** Lien vers un profil public, déjà traduit dans la langue demandée. */
export interface SocialLink {
  readonly slug: string;
  readonly kind: string;
  readonly url: string;
  readonly label: string;
}
