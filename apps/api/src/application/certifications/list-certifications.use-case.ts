import { type Certification as CertificationDto, type Locale } from '@siteperso/contracts';

import { type Certification } from '../../domain/certifications/certifications.js';
import { type CertificationsRepository } from './ports/certifications-repository.port.js';

function toDto(certification: Certification): CertificationDto {
  return {
    slug: certification.slug,
    issuer: certification.issuer,
    year: certification.year,
    url: certification.url,
    name: certification.name,
  };
}

/** Cas d'usage : liste des certifications publiées dans la langue demandée. Classe pure. */
export class ListCertificationsUseCase {
  constructor(private readonly certifications: CertificationsRepository) {}

  async execute(locale: Locale): Promise<CertificationDto[]> {
    return (await this.certifications.findAllPublished(locale)).map(toDto);
  }
}
