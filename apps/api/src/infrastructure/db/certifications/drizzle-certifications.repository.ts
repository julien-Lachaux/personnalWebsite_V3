import { type Locale } from '@siteperso/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { type CertificationsRepository } from '../../../application/certifications/ports/certifications-repository.port.js';
import { type Certification } from '../../../domain/certifications/certifications.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { certifications, certificationsTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/**
 * Dépôt Drizzle des certifications. Repli de langue en SQL, en une requête : `fr` obligatoire
 * (inner join), `locale` optionnelle (left join), repli par ligne (`translated`).
 */
export class DrizzleCertificationsRepository implements CertificationsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Certification[]> {
    const { fr, en } = translationAliases(certificationsTranslations);

    return this.client.db
      .select({
        slug: certifications.slug,
        issuer: certifications.issuer,
        year: certifications.year,
        url: certifications.url,
        name: translated(en, fr, 'name'),
      })
      .from(certifications)
      .innerJoin(fr, and(eq(fr.certificationId, certifications.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.certificationId, certifications.id), eq(en.locale, locale)))
      .where(and(eq(certifications.published, true), isNull(certifications.deletedAt)))
      .orderBy(asc(certifications.sortOrder), asc(certifications.id));
  }
}
