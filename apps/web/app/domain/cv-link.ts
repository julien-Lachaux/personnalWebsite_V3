// Lien du bouton « CV PDF » (D22) : l'API sert le chemin du CV de la langue de la page
// (`/cv/cv-<langue>.pdf`) ; tant que ce fichier manque dans `public/cv/`, le lien mène au CV français,
// signalé comme tel. Le repli cesse de lui-même quand le fichier de la langue est déposé : la liste des
// CV présents est relevée au build (`runtimeConfig.public.cvFiles`, nuxt.config.ts). Module pur.

/** Dossier des CV du site (`apps/web/public/cv/`), tel que servi. */
export const CV_DIRECTORY = '/cv/';
/** Langue du CV de repli : le CV d'origine, en français. */
export const CV_FALLBACK_LANGUAGE = 'fr';

/** Nom du fichier du CV d'une langue dans `public/cv/`. */
export function cvFileName(language: string): string {
  return `cv-${language}.pdf`;
}

export interface CvLink {
  /** Adresse du lien : celle reçue, ou celle du CV de repli. */
  readonly href: string;
  /** Langue du document servi à la place de celui de la page (repli), sinon `null`. */
  readonly fallbackLanguage: string | null;
}

/**
 * Lien du CV pour la page en `locale`, reçu à `href`, quand `public/cv/` contient `available`.
 *
 * Seul le CV propre à la langue de la page (`/cv/cv-<locale>.pdf`) est remplacé, et seulement s'il
 * manque et que le CV français est présent ; toute autre adresse (CV d'une autre langue, autre fichier,
 * adresse externe) est rendue telle quelle.
 */
export function resolveCvLink(href: string, locale: string, available: readonly string[]): CvLink {
  const own = cvFileName(locale);
  const fallback = cvFileName(CV_FALLBACK_LANGUAGE);
  const replaced =
    href === CV_DIRECTORY + own && !available.includes(own) && available.includes(fallback);
  return replaced
    ? { href: CV_DIRECTORY + fallback, fallbackLanguage: CV_FALLBACK_LANGUAGE }
    : { href, fallbackLanguage: null };
}
