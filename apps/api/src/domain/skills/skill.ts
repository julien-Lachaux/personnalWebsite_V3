/** Compétence technique, déjà traduite dans la langue demandée, rattachée à un groupe publié. */
export interface Skill {
  readonly slug: string;
  readonly name: string;
  /** Niveau de maîtrise, de 1 à 5. */
  readonly level: number;
  /** Slug devicon ou chemin SVG. */
  readonly icon: string;
  /** Chemin d'une icône statique propre ; `null` si `icon` suffit. */
  readonly iconPath: string | null;
  /** Slug du groupe de compétences parent. */
  readonly groupSlug: string;
}
