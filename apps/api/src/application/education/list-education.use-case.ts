import { type Education as EducationDto, type Locale } from '@siteperso/contracts';

import { type Education } from '../../domain/education/education.js';
import { type EducationRepository } from './ports/education-repository.port.js';

function toDto(education: Education): EducationDto {
  return {
    slug: education.slug,
    institution: education.institution,
    yearStart: education.yearStart,
    yearEnd: education.yearEnd,
    url: education.url,
    title: education.title,
    // Le contrat exige une chaîne alors que le SQL autorise une description absente.
    description: education.description ?? '',
  };
}

/** Cas d'usage : liste des formations publiées dans la langue demandée. Classe pure. */
export class ListEducationUseCase {
  constructor(private readonly education: EducationRepository) {}

  async execute(locale: Locale): Promise<EducationDto[]> {
    return (await this.education.findAllPublished(locale)).map(toDto);
  }
}
