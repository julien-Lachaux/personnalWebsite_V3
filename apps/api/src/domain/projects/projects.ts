/** Compétence mobilisée par un projet, déjà traduite (repli `fr` fait par le dépôt). */
export interface ProjectSkill {
  slug: string;
  name: string;
  level: number;
  icon: string;
  iconPath: string | null;
  groupSlug: string;
}

/**
 * Réalisation (projet) publiée. Les champs optionnels reflètent le schéma SQL : un projet peut
 * ne pas avoir d'adresse, de capture ni d'année. Le texte alternatif est partagé par les deux captures.
 */
export interface Project {
  slug: string;
  url: string | null;
  repoUrl: string | null;
  imageDesktopPath: string | null;
  imageMobilePath: string | null;
  imageAlt: string | null;
  year: number | null;
  title: string;
  description: string;
  skills: ProjectSkill[];
}
