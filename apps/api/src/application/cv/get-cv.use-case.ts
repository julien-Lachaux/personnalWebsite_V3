import {
  type Certification,
  type Cv,
  type Education,
  type Experience,
  type Language,
  type Locale,
  type Profile,
  type Project,
  type Recommendation,
  type Resource,
  type SkillGroup,
  type SocialLink,
  type Tool,
} from '@siteperso/contracts';

/** Forme commune des cas d'usage de lecture composés par le CV : `execute(locale)`. */
export interface LocalizedUseCase<T> {
  execute(locale: Locale): Promise<T>;
}

/**
 * Cas d'usage : agrégat du CV en un appel (`GET /cv`). Classe pure : elle compose les cas d'usage
 * des autres ressources, sans requête ni dépôt propres. Chaque dépendance est typée par
 * l'interface `{ execute(locale) }` : les classes `GetProfileUseCase`, `ListSocialLinksUseCase`…
 * la satisfont structurellement. Ordre du constructeur = ordre des clés de `CvSchema` (`locale` exclue).
 * Les compétences ne sont pas répétées à plat : elles sont imbriquées dans `skillGroups`.
 */
export class GetCvUseCase {
  constructor(
    private readonly getProfile: LocalizedUseCase<Profile>,
    private readonly listSocialLinks: LocalizedUseCase<SocialLink[]>,
    private readonly listSkillGroups: LocalizedUseCase<SkillGroup[]>,
    private readonly listExperiences: LocalizedUseCase<Experience[]>,
    private readonly listProjects: LocalizedUseCase<Project[]>,
    private readonly listTools: LocalizedUseCase<Tool[]>,
    private readonly listResources: LocalizedUseCase<Resource[]>,
    private readonly listCertifications: LocalizedUseCase<Certification[]>,
    private readonly listEducation: LocalizedUseCase<Education[]>,
    private readonly listLanguages: LocalizedUseCase<Language[]>,
    private readonly listRecommendations: LocalizedUseCase<Recommendation[]>,
  ) {}

  /**
   * Exécute les 11 cas d'usage en parallèle. Une seule erreur fait échouer l'ensemble : jamais de
   * réponse partielle. La validation stricte par `CvSchema` est faite une fois, par le controller.
   */
  async execute(locale: Locale): Promise<Cv> {
    const [
      profile,
      socialLinks,
      skillGroups,
      experiences,
      projects,
      tools,
      resources,
      certifications,
      education,
      languages,
      recommendations,
    ] = await Promise.all([
      this.getProfile.execute(locale),
      this.listSocialLinks.execute(locale),
      this.listSkillGroups.execute(locale),
      this.listExperiences.execute(locale),
      this.listProjects.execute(locale),
      this.listTools.execute(locale),
      this.listResources.execute(locale),
      this.listCertifications.execute(locale),
      this.listEducation.execute(locale),
      this.listLanguages.execute(locale),
      this.listRecommendations.execute(locale),
    ]);

    return {
      locale,
      profile,
      socialLinks,
      skillGroups,
      experiences,
      projects,
      tools,
      resources,
      certifications,
      education,
      languages,
      recommendations,
    };
  }
}
