/** Profil public, déjà traduit dans la langue demandée (une seule ligne, `id = 1`). */
export interface Profile {
  readonly firstName: string;
  readonly lastName: string;
  readonly location: string;
  readonly picturePath: string;
  readonly pictureAlt: string;
  readonly title: string;
  readonly headline: string;
  readonly bio: string;
  readonly availability: string;
}
