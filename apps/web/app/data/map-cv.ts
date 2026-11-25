// Mapping contrat → modèles de vue (docs/04, champ par champ). Fonctions pures : le contrat `Cv`
// entre, les modèles de `cv-view.ts` sortent ; les libellés d'interface sont injectés (`CvLabels`),
// aucune chaîne d'interface ici. Les dates et la ligne de métadonnées passent par `domain/format`,
// les technos et les expériences se prêtent à `domain/filter` (slugs en puces et mots-clés cachés).
import {
  type AiOverview,
  type Cv,
  type Experience,
  type Profile,
  type Recommendation,
  type SkillGroup,
  type SocialLink,
} from '@siteperso/contracts';

import { mainStack, type FilterTech } from '../domain/filter.js';
import {
  formatExperienceMeta,
  formatPeriod,
  formatRecommendationDate,
  type Locale,
} from '../domain/format.js';
import {
  type AiView,
  type CvLabels,
  type CvView,
  type ExperienceView,
  type LinksView,
  type LinkView,
  type ProfileView,
  type RecommendationView,
  type StackChipView,
  type TechsView,
} from './cv-view.js';

/** Séparateur entre la relation et la date d'une recommandation. */
const CONTEXT_SEPARATOR = ' · ';

/** Slugs des liens sociaux lus par le front (docs/04, « Liens »). */
const LINKEDIN = 'linkedin';
const GITHUB = 'github';
const LINKEDIN_RECOMMENDATIONS = 'linkedin-recommendations';

/** Titre coupé après son premier mot (« Développeur » / « full-stack ») ; une ligne s'il n'en a qu'un. */
const TITLE_LINES = /^(\S+)\s+(.*\S)/;

/** Profil. */
export function mapProfile(profile: Profile): ProfileView {
  const lines = TITLE_LINES.exec(profile.title);
  return {
    title: profile.title,
    titleLines: lines === null ? [profile.title] : lines.slice(1, 3),
    badge: profile.titleBadge,
    taglines: profile.taglines,
    intro: profile.intro,
    mission: profile.mission,
    currently: profile.currentActivity,
    lookingFor: {
      format: profile.seekingFormat,
      location: profile.seekingLocation,
      availability: profile.seekingAvailability,
    },
    cvPath: profile.cvPath,
  };
}

function linkView(links: readonly SocialLink[], slug: string): LinkView | null {
  const link = links.find((candidate) => candidate.slug === slug);
  return link === undefined ? null : { url: link.url, label: link.label };
}

/** Liens : un lien que l'API ne sert pas vaut `null` (par exemple GitHub tant que l'URL manque). */
export function mapLinks(socialLinks: readonly SocialLink[]): LinksView {
  return {
    linkedin: linkView(socialLinks, LINKEDIN),
    github: linkView(socialLinks, GITHUB),
    linkedinRecommendations: linkView(socialLinks, LINKEDIN_RECOMMENDATIONS),
  };
}

/**
 * URL du lien social `linkedin`, seule donnée du CV que lit la page « travaux en cours » (lot 31) ;
 * absent, lève : la génération échoue plutôt que d'afficher un bouton mort.
 */
export function linkedinUrl(cv: Pick<Cv, 'socialLinks'>): string {
  const link = linkView(cv.socialLinks, LINKEDIN);
  if (link === null) {
    throw new Error(
      'Lien LinkedIn absent du CV : la page « travaux en cours » attend un lien social de slug ' +
        '« linkedin » (social_links).',
    );
  }
  return link.url;
}

/** Puces de la pile : les technos affichées ; pour une pause, la seule puce `stackLabel`. */
function stackChips(experience: Experience): StackChipView[] {
  if (experience.kind === 'break') {
    return experience.stackLabel === null
      ? []
      : [{ slug: null, label: experience.stackLabel, easterEgg: true }];
  }
  return experience.skills
    .filter((skill) => skill.shownInStack)
    .map((skill) => ({ slug: skill.slug, label: skill.name, easterEgg: false }));
}

/** Expériences, dans l'ordre de l'API (plus récente d'abord). */
export function mapExperiences(
  experiences: readonly Experience[],
  locale: Locale,
  labels: CvLabels,
): ExperienceView[] {
  return experiences.map((experience) => {
    const isBreak = experience.kind === 'break';
    return {
      slug: experience.slug,
      kind: experience.kind,
      title: experience.jobTitle,
      organisation: isBreak ? labels.breakOrganisation : experience.company,
      prefix: isBreak ? '›' : '@',
      period: formatPeriod(experience.dateStart, experience.dateEnd, locale, labels.present),
      meta: formatExperienceMeta(experience, labels),
      summary: experience.summary,
      achievements: experience.achievements,
      stack: stackChips(experience),
      visibleSlugs: experience.skills.filter((s) => s.shownInStack).map((s) => s.slug),
      hiddenSlugs: experience.skills.filter((s) => !s.shownInStack).map((s) => s.slug),
    };
  });
}

/** Technos : groupes de l'API, liste à plat pour le filtre et stack principale triée. */
export function mapTechs(skillGroups: readonly SkillGroup[]): TechsView {
  const groups = skillGroups.map((group) => ({
    slug: group.slug,
    name: group.name,
    techs: group.skills.map((skill): FilterTech => ({
      slug: skill.slug,
      name: skill.name,
      groupSlug: skill.groupSlug,
      mainStackOrder: skill.mainStackOrder,
    })),
  }));
  const all = groups.flatMap((group) => group.techs);
  return { groups, all, total: all.length, mainStack: mainStack(all) };
}

/**
 * Recommandations publiées (l'API ne sert que celles-là) : liste vide si aucune. La date suit la
 * langue de la citation (`locale`, `fr` en repli) pour que la ligne de contexte reste homogène.
 */
export function mapRecommendations(
  recommendations: readonly Recommendation[],
): RecommendationView[] {
  return recommendations.map((recommendation) => ({
    slug: recommendation.slug,
    author: recommendation.authorName,
    role: recommendation.authorRole,
    context:
      recommendation.relationship +
      CONTEXT_SEPARATOR +
      formatRecommendationDate(recommendation.recommendedOn, recommendation.locale),
    paragraphs: recommendation.paragraphs,
    lang: recommendation.locale,
  }));
}

/** Section IA ; `null` quand l'API ne la sert pas. */
export function mapAi(aiOverview: AiOverview | null): AiView | null {
  if (aiOverview === null) return null;
  return {
    title: aiOverview.title,
    inProduct: { label: aiOverview.inProductLabel, items: aiOverview.inProductItems },
    daily: { label: aiOverview.dailyLabel, text: aiOverview.dailyText },
    tags: aiOverview.skills.map((skill) => ({ slug: skill.slug, name: skill.name })),
  };
}

/** Le CV complet vu par la page, dans la langue servie par l'API (`cv.locale`). */
export function mapCv(cv: Cv, labels: CvLabels): CvView {
  return {
    locale: cv.locale,
    profile: mapProfile(cv.profile),
    links: mapLinks(cv.socialLinks),
    experiences: mapExperiences(cv.experiences, cv.locale, labels),
    techs: mapTechs(cv.skillGroups),
    recommendations: mapRecommendations(cv.recommendations),
    ai: mapAi(cv.aiOverview),
  };
}
