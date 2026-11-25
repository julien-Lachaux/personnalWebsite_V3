// Menu du CV (D44, qui remplace le repli de D22) : le bouton « CV PDF » propose toujours les deux
// versions, française et anglaise. Une version dont le fichier manque dans `public/cv/` (liste relevée
// au build, `runtimeConfig.public.cvFiles`, nuxt.config.ts) reste proposée mais inactive ; elle devient
// un lien dès que `cv-<langue>.pdf` est déposé. Module pur.

/** Langues des CV proposés, dans l'ordre du menu. */
export const CV_LANGUAGES = ['fr', 'en'] as const;

export type CvLanguage = (typeof CV_LANGUAGES)[number];

/** Nom du fichier du CV d'une langue dans `public/cv/`. */
export function cvFileName(language: string): string {
  return `cv-${language}.pdf`;
}

export interface CvVersion {
  readonly language: CvLanguage;
  /** Adresse du fichier de cette langue (même dossier que l'adresse du CV reçue de l'API). */
  readonly href: string;
  /** Le fichier est présent : sinon l'entrée est affichée sans lien. */
  readonly available: boolean;
}

/**
 * Versions du CV à proposer, à partir de l'adresse `href` reçue (celle du CV de la page, de la forme
 * `<dossier>/cv-<langue>.pdf`) et des fichiers présents dans `public/cv/`.
 */
export function cvVersions(href: string, available: readonly string[]): readonly CvVersion[] {
  const directory = href.slice(0, href.lastIndexOf('/') + 1);
  return CV_LANGUAGES.map((language) => ({
    language,
    href: directory + cvFileName(language),
    available: available.includes(cvFileName(language)),
  }));
}
