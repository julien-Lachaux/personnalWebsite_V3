import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../db/database.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { SocialLinksModule } from './social-links/social-links.module.js';
import { SkillGroupsModule } from './skill-groups/skill-groups.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { ExperiencesModule } from './experiences/experiences.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { ToolsModule } from './tools/tools.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { CertificationsModule } from './certifications/certifications.module.js';
import { EducationModule } from './education/education.module.js';
import { LanguagesModule } from './languages/languages.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { CvModule } from './cv/cv.module.js';
import { DocsModule } from './docs/docs.module.js';
import { HealthModule } from './health/health.module.js';

/** Modules de ressources (un par entrée de docs/01), dans l'ordre du contrat d'API. */
const RESOURCE_MODULES = [
  ProfileModule,
  SocialLinksModule,
  SkillGroupsModule,
  SkillsModule,
  ExperiencesModule,
  ProjectsModule,
  ToolsModule,
  ResourcesModule,
  CertificationsModule,
  EducationModule,
  LanguagesModule,
  RecommendationsModule,
  CvModule,
];

/**
 * Module racine. Fichier PARTAGÉ : au lot 3, les agents API n'y touchent pas, chaque module
 * de ressource est déjà enregistré ci-dessous (voir CLAUDE.md, règle « modules isolés »).
 */
@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, DocsModule, ...RESOURCE_MODULES],
})
export class AppModule {}
