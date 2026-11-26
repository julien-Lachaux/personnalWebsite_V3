// Source de fixtures : les CV `fr` et `en` de `fixtures/`, revalidés par le contrat à chaque lecture.
// Sert au développement sans API et aux parcours Playwright (choix par configuration, docs/04). Les
// fixtures du dépôt ne sont importées qu'à la première lecture (lot F11, F11-01) : une génération sur
// l'API (`select-cv-source.ts`) ne les charge jamais.
import { type Cv, type Locale } from '@siteperso/contracts';

import { type CvSource } from './cv-source.js';
import { parseCv } from './parse-cv.js';

type Fixtures = Readonly<Record<Locale, unknown>>;

/** CV `fr` et `en` de `fixtures/`, importés à la demande. */
async function repositoryFixtures(): Promise<Fixtures> {
  const [{ cvFr }, { cvEn }] = await Promise.all([
    import('./fixtures/cv.fr.js'),
    import('./fixtures/cv.en.js'),
  ]);
  return { fr: cvFr, en: cvEn };
}

export class FixtureCvSource implements CvSource {
  /** `fixtures` : CV par langue (ceux du dépôt par défaut). */
  constructor(private readonly fixtures?: Fixtures) {}

  async load(locale: Locale): Promise<Cv> {
    const fixtures = this.fixtures ?? (await repositoryFixtures());
    return parseCv(fixtures[locale], locale, `fixture ${locale}`);
  }
}
