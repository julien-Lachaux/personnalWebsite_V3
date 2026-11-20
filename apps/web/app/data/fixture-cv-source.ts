// Source de fixtures : les CV `fr` et `en` de `fixtures/`, revalidés par le contrat à chaque lecture.
// Sert au développement sans API et aux parcours Playwright (choix par configuration, docs/04).
import { type Cv, type Locale } from '@siteperso/contracts';

import { type CvSource } from './cv-source.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';
import { parseCv } from './parse-cv.js';

const FIXTURES: Readonly<Record<Locale, Cv>> = { fr: cvFr, en: cvEn };

export class FixtureCvSource implements CvSource {
  constructor(private readonly fixtures: Readonly<Record<Locale, unknown>> = FIXTURES) {}

  load(locale: Locale): Promise<Cv> {
    return Promise.resolve().then(() =>
      parseCv(this.fixtures[locale], locale, `fixture ${locale}`),
    );
  }
}
