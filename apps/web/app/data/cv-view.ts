// Modèles de vue du CV (docs/04) : ce que les sections affichent, déjà prêt à l'emploi. Le mapping
// depuis le contrat de l'API vit dans `map-cv.ts`. Aucun type de Vue, de Nuxt ni de Zod ici : les
// composants et leurs tests s'en servent sans rien connaître de l'API.
import { type ExperienceKind, type Locale } from '@siteperso/contracts';

import { type FilterExperience, type FilterTech } from '../domain/filter.js';

/** Lien externe affiché (bouton LinkedIn, GitHub, recommandations). */
export interface LinkView {
  readonly url: string;
  /** Libellé servi par l'API, dans la langue demandée. */
  readonly label: string;
}

/** Section « profil » : titre, accroches, texte et « ce que je recherche ». */
export interface ProfileView {
  /** Titre complet (« Développeur full-stack »). */
  readonly title: string;
  /** Titre coupé en deux lignes de présentation (premier mot, puis le reste) ; une ligne si un mot. */
  readonly titleLines: readonly string[];
  /** Pastille accolée au titre (« senior »). */
  readonly badge: string;
  readonly taglines: readonly string[];
  readonly intro: string;
  readonly mission: string;
  /** « En ce moment ». */
  readonly currently: string;
  readonly lookingFor: {
    readonly format: string;
    readonly location: string;
    readonly availability: string;
  };
  /** Chemin du CV en PDF, propre à la langue (fichier statique du front). */
  readonly cvPath: string;
}

/** Liens du profil ; `null` quand l'API ne le sert pas (le bouton est alors masqué). */
export interface LinksView {
  readonly linkedin: LinkView | null;
  readonly github: LinkView | null;
  /** « Recommandations publiées sur LinkedIn ». */
  readonly linkedinRecommendations: LinkView | null;
}

/** Puce de la pile d'une expérience. */
export interface StackChipView {
  /** Slug de la techno ; `null` pour la puce de l'expérience `break` (ouvre l'easter egg). */
  readonly slug: string | null;
  readonly label: string;
  /** Vrai pour la puce « Huile de coude » de la pause professionnelle. */
  readonly easterEgg: boolean;
}

/** Carte d'expérience ; les champs de `FilterExperience` alimentent le filtre par techno. */
export interface ExperienceView extends FilterExperience {
  readonly kind: ExperienceKind;
  readonly title: string;
  /** Employeur ; libellé injecté pour une pause ; `null` si l'API n'en donne pas. */
  readonly organisation: string | null;
  /** `@` devant l'employeur, `›` devant le libellé d'une pause. */
  readonly prefix: '@' | '›';
  /** « janv. 2026 – mai 2026 » (« aujourd'hui » si en cours). */
  readonly period: string;
  /** « Paris, hybride · CDI » ; vide si rien à afficher (la carte masque la ligne). */
  readonly meta: string;
  readonly summary: string;
  /** Détail de l'accordéon ; vide : pas d'accordéon. */
  readonly achievements: readonly string[];
  readonly stack: readonly StackChipView[];
}

/** Groupe de technos du panneau « Toutes les technos (N) ». */
export interface TechGroupView {
  readonly slug: string;
  readonly name: string;
  readonly techs: readonly FilterTech[];
}

/** Technos du filtre. */
export interface TechsView {
  readonly groups: readonly TechGroupView[];
  /** Toutes les technos, dans l'ordre des groupes (entrée de `domain/filter`). */
  readonly all: readonly FilterTech[];
  /** N de « Toutes les technos (N) ». */
  readonly total: number;
  /** Stack principale, triée par rang. */
  readonly mainStack: readonly FilterTech[];
}

/** Carte de recommandation. */
export interface RecommendationView {
  readonly slug: string;
  readonly author: string;
  readonly role: string;
  /** « Responsable direct de Julien · 8 décembre 2025 » (date dans la langue de la citation). */
  readonly context: string;
  readonly paragraphs: readonly string[];
  /** Langue du texte de la carte (`fr` en repli, même sur la page `en`) : attribut `lang`. */
  readonly lang: Locale;
}

/** Section IA. */
export interface AiView {
  readonly title: string;
  readonly inProduct: { readonly label: string; readonly items: readonly string[] };
  readonly daily: { readonly label: string; readonly text: string };
  readonly tags: readonly { readonly slug: string; readonly name: string }[];
}

/** Tout ce que la page affiche, pour une langue. */
export interface CvView {
  readonly locale: Locale;
  readonly profile: ProfileView;
  readonly links: LinksView;
  readonly experiences: readonly ExperienceView[];
  readonly techs: TechsView;
  /** Vide si aucune recommandation n'est publiée (état vide prévu par la section). */
  readonly recommendations: readonly RecommendationView[];
  /** `null` si la section IA est absente ou supprimée. */
  readonly ai: AiView | null;
}

/** Libellés d'interface injectés par l'appelant (i18n) : `data/` n'en porte aucun. */
export interface CvLabels {
  /** Fin de période d'une expérience en cours (« aujourd'hui », « present »). */
  readonly present: string;
  /** Organisation d'une pause professionnelle (« Projet personnel »). */
  readonly breakOrganisation: string;
  /** Libellé d'un mode de travail (`onsite`, `hybrid`, `remote`). */
  workMode(value: string): string;
  /** Libellé d'un type de contrat (`cdi`, `freelance` ; `none` n'est jamais demandé). */
  contractType(value: string): string;
}
