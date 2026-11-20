import { CvSchema, type Cv } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { cvEn } from './cv.en.js';
import { cvFr } from './cv.fr.js';

const FIXTURES: readonly (readonly [string, Cv])[] = [
  ['fr', cvFr],
  ['en', cvEn],
];

describe.each(FIXTURES)('fixture %s', (locale, cv) => {
  it('respecte le contrat Cv de @siteperso/contracts (le jour où il change, ce test casse)', () => {
    const parsed = CvSchema.safeParse(cv);

    expect(parsed.error?.issues).toBeUndefined();
    expect(parsed.success).toBe(true);
    expect(cv.locale).toBe(locale);
  });

  it('ne contient aucune donnée personnelle de contact ni identité réelle', () => {
    const text = JSON.stringify(cv);

    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/); // adresse e-mail
    expect(text).not.toMatch(/(?:\+\d|\b0\d)[\d .-]{7,}\d/); // numéro de téléphone
    expect(text).not.toMatch(/mailto:|tel:/);
    expect(text).not.toContain('Lachaux');
    expect(cv.profile.firstName).toBe('Prénom');
    expect(cv.profile.lastName).toBe('Nom');
    for (const link of cv.socialLinks) {
      expect(link.url).toMatch(/^https:\/\/www\.linkedin\.com\/in\/example/);
    }
  });

  it('donne de quoi afficher chaque section du design v6', () => {
    expect(cv.profile.taglines).toHaveLength(2);
    expect(cv.profile.cvPath).toBe(`/cv/cv-${locale}.pdf`);
    expect(cv.socialLinks.map((link) => link.slug)).toEqual([
      'linkedin',
      'linkedin-recommendations',
    ]);
    expect(cv.skillGroups).toHaveLength(7);
    expect(cv.experiences).toHaveLength(8);
    expect(cv.aiOverview?.skills.length).toBeGreaterThan(0);
  });

  it('publie les recommandations, en français (la citation n’est pas traduite)', () => {
    expect(cv.recommendations.map((reco) => reco.slug)).toEqual([
      'alexis-coudeyras',
      'steeve-chevry',
      'eric-bisceglia',
    ]);
    expect(cv.recommendations.map((reco) => reco.locale)).toEqual(['fr', 'fr', 'fr']);
    expect(cv.recommendations[0]?.recommendedOn).toBe('2025-12-08');
  });

  it('a une stack principale de sept technos, rangs de 1 à 7 sans doublon', () => {
    const ranks = cv.skillGroups
      .flatMap((group) => group.skills.map((skill) => skill.mainStackOrder))
      .filter((rank) => rank !== null)
      .sort();

    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('ne relie une expérience qu’à des compétences de ses groupes', () => {
    const known = new Set(
      cv.skillGroups.flatMap((group) => group.skills.map((skill) => skill.slug)),
    );

    for (const experience of cv.experiences) {
      for (const skill of experience.skills) {
        expect(known.has(skill.slug), `${experience.slug} : ${skill.slug}`).toBe(true);
      }
    }
  });

  it('couvre les cas du mapping : pause sans employeur, mentorat sans contrat, en cours absent', () => {
    const pause = cv.experiences.find((experience) => experience.kind === 'break');
    const mentoring = cv.experiences.find((experience) => experience.kind === 'mentoring');

    expect(pause).toMatchObject({ company: null, contractType: null });
    expect(pause?.stackLabel).toEqual(expect.stringMatching(/\S/));
    expect(mentoring).toMatchObject({ contractType: 'none', workMode: 'remote' });
    expect(cv.socialLinks.some((link) => link.kind === 'github')).toBe(false);
  });
});

describe('parité des deux fixtures', () => {
  it('portent les mêmes entités, seuls les textes changent', () => {
    const shape = (cv: Cv) => ({
      experiences: cv.experiences.map((e) => [e.slug, e.kind, e.dateStart, e.dateEnd]),
      skills: cv.skillGroups.map((g) => [g.slug, g.skills.map((s) => s.slug)]),
      links: cv.socialLinks.map((l) => l.slug),
      recommendations: cv.recommendations.map((r) => r.slug),
      ai: cv.aiOverview?.skills.map((s) => s.slug),
    });

    expect(shape(cvEn)).toEqual(shape(cvFr));
    expect(cvEn.profile.title).not.toBe(cvFr.profile.title);
  });
});
