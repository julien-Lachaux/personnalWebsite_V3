import { describe, expect, it } from 'vitest';

import { CvSourceError } from './cv-source.js';
import { FixtureCvSource } from './fixture-cv-source.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';

describe('FixtureCvSource', () => {
  it('sert la fixture de la langue demandée', async () => {
    const source = new FixtureCvSource();

    expect(await source.load('fr')).toEqual(cvFr);
    expect(await source.load('en')).toEqual(cvEn);
  });

  it('rend une copie validée : modifier le résultat ne touche pas la fixture', async () => {
    const first = await new FixtureCvSource().load('fr');
    first.profile.title = 'modifié';

    expect((await new FixtureCvSource().load('fr')).profile.title).toBe(cvFr.profile.title);
  });

  it('refuse une fixture hors contrat, en nommant la fixture et le champ', async () => {
    const broken = { fr: { ...cvFr, locale: 'de' }, en: cvEn };

    const failure = new FixtureCvSource(broken).load('fr');

    await expect(failure).rejects.toBeInstanceOf(CvSourceError);
    await expect(failure).rejects.toThrow(
      /^Réponse non conforme au contrat Cv \(fixture fr\) : locale : /,
    );
  });

  it('refuse une fixture rangée sous la mauvaise langue', async () => {
    const swapped = { fr: cvEn, en: cvFr };

    await expect(new FixtureCvSource(swapped).load('fr')).rejects.toThrow(
      'Langue inattendue (fixture fr) : « fr » demandée, « en » reçue',
    );
  });
});
