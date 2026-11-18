import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { type EducationRepository } from '../../../application/education/ports/education-repository.port.js';
import { type Education } from '../../../domain/education/education.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { education, educationTranslations } from '../schema/index.js';
import { translated } from '../translated.js';

/**
 * Dépôt Drizzle des formations. Repli de langue en SQL, en une requête : `fr` obligatoire
 * (inner join), `locale` optionnelle (left join), `coalesce(en, fr)` par champ traduit.
 */
@Injectable()
export class DrizzleEducationRepository implements EducationRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Education[]> {
    const fr = alias(educationTranslations, 'fr');
    const en = alias(educationTranslations, 'en');

    return this.client.db
      .select({
        slug: education.slug,
        institution: education.institution,
        yearStart: education.yearStart,
        yearEnd: education.yearEnd,
        url: education.url,
        title: translated(en.title, fr.title),
        description: translated<string | null>(en.description, fr.description),
      })
      .from(education)
      .innerJoin(fr, and(eq(fr.educationId, education.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.educationId, education.id), eq(en.locale, locale)))
      .where(eq(education.published, true))
      .orderBy(asc(education.sortOrder), asc(education.id));
  }
}
