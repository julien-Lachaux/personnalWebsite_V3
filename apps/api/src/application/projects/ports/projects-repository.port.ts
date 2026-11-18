import { type Locale } from '@siteperso/contracts';

import { type Project } from '../../../domain/projects/projects.js';

/** Jeton d'injection du dépôt des projets. */
export const PROJECTS_REPOSITORY = Symbol('PROJECTS_REPOSITORY');

/** Port de lecture des projets. */
export interface ProjectsRepository {
  /**
   * Projets publiés triés par `sort_order` puis `id`, avec leurs compétences publiées triées par
   * `project_skills.sort_order`. Textes dans `locale`, repli sur `fr` fait par le dépôt.
   */
  findAllPublished(locale: Locale): Promise<Project[]>;
}
