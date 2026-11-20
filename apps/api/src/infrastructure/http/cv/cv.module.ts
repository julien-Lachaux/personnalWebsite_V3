import { Module } from '@nestjs/common';

import { FindAiOverviewUseCase } from '../../../application/ai-overview/find-ai-overview.use-case.js';
import { ListCertificationsUseCase } from '../../../application/certifications/list-certifications.use-case.js';
import { GetCvUseCase } from '../../../application/cv/get-cv.use-case.js';
import { ListEducationUseCase } from '../../../application/education/list-education.use-case.js';
import { ListExperiencesUseCase } from '../../../application/experiences/list-experiences.use-case.js';
import { ListLanguagesUseCase } from '../../../application/languages/list-languages.use-case.js';
import { GetProfileUseCase } from '../../../application/profile/get-profile.use-case.js';
import { ListProjectsUseCase } from '../../../application/projects/list-projects.use-case.js';
import { ListRecommendationsUseCase } from '../../../application/recommendations/list-recommendations.use-case.js';
import { ListResourcesUseCase } from '../../../application/resources/list-resources.use-case.js';
import { ListSkillGroupsUseCase } from '../../../application/skill-groups/list-skill-groups.use-case.js';
import { ListSocialLinksUseCase } from '../../../application/social-links/list-social-links.use-case.js';
import { ListToolsUseCase } from '../../../application/tools/list-tools.use-case.js';
import { AiOverviewModule } from '../ai-overview/ai-overview.module.js';
import { CertificationsModule } from '../certifications/certifications.module.js';
import { EducationModule } from '../education/education.module.js';
import { ExperiencesModule } from '../experiences/experiences.module.js';
import { LanguagesModule } from '../languages/languages.module.js';
import { ProfileModule } from '../profile/profile.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { ResourcesModule } from '../resources/resources.module.js';
import { SkillGroupsModule } from '../skill-groups/skill-groups.module.js';
import { SocialLinksModule } from '../social-links/social-links.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { CvController } from './cv.controller.js';

/**
 * Module de la ressource « CV agrégé ». Aucun dépôt propre : il importe les modules des 12
 * ressources agrégées et compose leurs cas d'usage exportés. L'ordre de `inject` est celui des
 * paramètres du constructeur de `GetCvUseCase` (ordre des clés de `CvSchema`, `locale` exclue).
 * `ListSkillsUseCase` n'en fait pas partie : les compétences sont imbriquées dans `skillGroups`.
 */
@Module({
  imports: [
    ProfileModule,
    SocialLinksModule,
    SkillGroupsModule,
    ExperiencesModule,
    ProjectsModule,
    ToolsModule,
    ResourcesModule,
    CertificationsModule,
    EducationModule,
    LanguagesModule,
    RecommendationsModule,
    AiOverviewModule,
  ],
  controllers: [CvController],
  providers: [
    {
      provide: GetCvUseCase,
      useFactory: (
        profile: GetProfileUseCase,
        socialLinks: ListSocialLinksUseCase,
        skillGroups: ListSkillGroupsUseCase,
        experiences: ListExperiencesUseCase,
        projects: ListProjectsUseCase,
        tools: ListToolsUseCase,
        resources: ListResourcesUseCase,
        certifications: ListCertificationsUseCase,
        education: ListEducationUseCase,
        languages: ListLanguagesUseCase,
        recommendations: ListRecommendationsUseCase,
        aiOverview: FindAiOverviewUseCase,
      ) =>
        new GetCvUseCase(
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
          aiOverview,
        ),
      inject: [
        GetProfileUseCase,
        ListSocialLinksUseCase,
        ListSkillGroupsUseCase,
        ListExperiencesUseCase,
        ListProjectsUseCase,
        ListToolsUseCase,
        ListResourcesUseCase,
        ListCertificationsUseCase,
        ListEducationUseCase,
        ListLanguagesUseCase,
        ListRecommendationsUseCase,
        FindAiOverviewUseCase,
      ],
    },
  ],
})
export class CvModule {}
