import { type Cv } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type CvLabels } from './cv-view.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';
import {
  mapAi,
  mapCv,
  mapExperiences,
  mapLinks,
  mapProfile,
  mapRecommendations,
  mapTechs,
} from './map-cv.js';

/** Libellés de test : volontairement ni français ni anglais, pour prouver qu'ils sont injectés. */
const labels: CvLabels = {
  present: 'PRESENT',
  breakOrganisation: 'ORG-PAUSE',
  workMode: (value) => `WM[${value}]`,
  contractType: (value) => `CT[${value}]`,
};

const experienceOf = (cv: Cv, slug: string) => {
  const experience = cv.experiences.find((candidate) => candidate.slug === slug);
  if (experience === undefined) throw new Error(`expérience absente : ${slug}`);
  return experience;
};

describe('mapProfile', () => {
  it('reprend les champs du profil, titre coupé en deux lignes', () => {
    expect(mapProfile(cvFr.profile)).toEqual({
      title: 'Développeur full-stack',
      titleLines: ['Développeur', 'full-stack'],
      badge: 'senior',
      taglines: [
        'NestJS, Vue.js — données, ETL et analytics',
        'Développement assisté par IA et agentique',
      ],
      intro: cvFr.profile.intro,
      mission: cvFr.profile.mission,
      currently: cvFr.profile.currentActivity,
      lookingFor: {
        format: 'Temps partiel (3 jours par semaine) ou missions freelance courtes',
        location: 'Paris, Île-de-France · hybride ou à distance',
        availability: 'Immédiate',
      },
      cvPath: '/cv/cv-fr.pdf',
    });
  });

  it('coupe le titre anglais après son premier mot et garde le chemin du CV anglais', () => {
    const view = mapProfile(cvEn.profile);

    expect(view.titleLines).toEqual(['Full-stack', 'developer']);
    expect(view.cvPath).toBe('/cv/cv-en.pdf');
  });

  it('garde une seule ligne pour un titre d’un mot, et n’en perd aucun mot sinon', () => {
    expect(mapProfile({ ...cvFr.profile, title: 'Développeur' }).titleLines).toEqual([
      'Développeur',
    ]);
    expect(mapProfile({ ...cvFr.profile, title: 'Lead  tech  senior' }).titleLines).toEqual([
      'Lead',
      'tech  senior',
    ]);
    expect(mapProfile({ ...cvFr.profile, title: 'Lead tech ' }).titleLines).toEqual([
      'Lead',
      'tech',
    ]);
  });

  it('ne coupe pas un titre qui commence ou finit par des espaces sans second mot', () => {
    expect(mapProfile({ ...cvFr.profile, title: 'Lead ' }).titleLines).toEqual(['Lead ']);
    expect(mapProfile({ ...cvFr.profile, title: ' Lead tech' }).titleLines).toEqual([' Lead tech']);
  });
});

describe('mapLinks', () => {
  it('rend LinkedIn et les recommandations ; GitHub absent donne null (bouton masqué)', () => {
    expect(mapLinks(cvFr.socialLinks)).toEqual({
      linkedin: { url: 'https://www.linkedin.com/in/example', label: 'LinkedIn' },
      github: null,
      linkedinRecommendations: {
        url: 'https://www.linkedin.com/in/example/details/recommendations/',
        label: 'Recommandations publiées sur LinkedIn',
      },
    });
  });

  it('rend GitHub dès que l’API le sert', () => {
    const links = [
      ...cvFr.socialLinks,
      { slug: 'github', kind: 'github', url: 'https://github.com/example', label: 'GitHub' },
    ];

    expect(mapLinks(links).github).toEqual({ url: 'https://github.com/example', label: 'GitHub' });
  });

  it('rend null pour chaque lien absent', () => {
    expect(mapLinks([])).toEqual({ linkedin: null, github: null, linkedinRecommendations: null });
  });

  it('ne confond pas les liens : le slug fait l’identité, pas le type', () => {
    const only = [{ slug: 'site', kind: 'github', url: 'https://example.org', label: 'Site' }];

    expect(mapLinks(only).github).toBeNull();
  });
});

describe('mapExperiences', () => {
  const all = () => mapExperiences(cvFr.experiences, 'fr', labels);
  const bySlug = (slug: string) => {
    const view = all().find((candidate) => candidate.slug === slug);
    if (view === undefined) throw new Error(`vue absente : ${slug}`);
    return view;
  };

  it('garde l’ordre de l’API et un modèle par expérience', () => {
    expect(all().map((e) => e.slug)).toEqual(cvFr.experiences.map((e) => e.slug));
    expect(all().map((e) => e.kind)).toEqual([
      'employment',
      'break',
      'employment',
      'employment',
      'employment',
      'freelance',
      'employment',
      'mentoring',
    ]);
  });

  it('formate la période et la ligne de lieu avec les libellés injectés', () => {
    const nopillo = bySlug('nopillo');

    expect(nopillo.period).toBe('janv. 2026 – mai 2026');
    expect(nopillo.meta).toBe('Paris, WM[hybrid] · CT[cdi]');
    expect(nopillo.title).toBe('Senior Software Engineer');
    expect(nopillo.organisation).toBe('Nopillo');
    expect(nopillo.prefix).toBe('@');
    expect(nopillo.summary).toBe(cvFr.experiences[0]?.summary);
    expect(nopillo.achievements).toEqual(cvFr.experiences[0]?.achievements);
    expect(bySlug('leboncoin').meta).toBe('Paris, WM[hybrid] · CT[freelance]');
  });

  it('une expérience en cours (dateEnd nul) affiche le libellé injecté', () => {
    const ongoing = cvFr.experiences.map((experience) =>
      experience.slug === 'nopillo' ? { ...experience, dateEnd: null } : experience,
    );

    const view = mapExperiences(ongoing, 'fr', labels).find((e) => e.slug === 'nopillo');

    expect(view?.period).toBe('janv. 2026 – PRESENT');
  });

  it('formate les dates dans la langue du CV', () => {
    const english = mapExperiences(cvEn.experiences, 'en', labels);

    expect(english.find((e) => e.slug === 'nopillo')?.period).toBe('Jan 2026 – May 2026');
  });

  it('une pause : organisation et préfixe viennent des libellés, une puce ouvre l’easter egg', () => {
    const pause = bySlug('pause-professionnelle');

    expect(pause.organisation).toBe('ORG-PAUSE');
    expect(pause.prefix).toBe('›');
    expect(pause.kind).toBe('break');
    expect(pause.period).toBe('avr. 2024 – déc. 2025');
    expect(pause.meta).toBe('');
    expect(pause.stack).toEqual([{ slug: null, label: 'Huile de coude', easterEgg: true }]);
    expect(pause.achievements).toEqual([]);
    expect(pause.visibleSlugs).toEqual([]);
    expect(pause.hiddenSlugs).toEqual([]);
  });

  it('une pause sans stackLabel n’a aucune puce ; les technos d’une pause ne sont pas des puces', () => {
    const base = experienceOf(cvFr, 'pause-professionnelle');
    const typescript = experienceOf(cvFr, 'nopillo').skills[0];
    if (typescript === undefined) throw new Error('compétence absente');
    const variants = [
      { ...base, stackLabel: null, skills: [] },
      { ...base, stackLabel: null, skills: [typescript] },
    ];

    const [empty, withSkill] = mapExperiences(variants, 'fr', labels);

    expect(empty?.stack).toEqual([]);
    expect(withSkill?.stack).toEqual([]);
    expect(withSkill?.visibleSlugs).toEqual(['typescript']);
  });

  it('le contrat none n’affiche rien ; un mode de travail seul reste', () => {
    const mentor = bySlug('openclassrooms-mentor');

    expect(mentor.meta).toBe('À distance, WM[remote]');
    expect(mentor.prefix).toBe('@');
    expect(mentor.organisation).toBe('OpenClassrooms');
    expect(mentor.kind).toBe('mentoring');
  });

  it('puces = technos affichées dans l’ordre ; mots-clés cachés = technos non affichées', () => {
    const nopillo = bySlug('nopillo');

    expect(nopillo.stack).toEqual([
      { slug: 'typescript', label: 'TypeScript', easterEgg: false },
      { slug: 'elysia', label: 'Elysia.js', easterEgg: false },
      { slug: 'solidjs', label: 'Solid.js', easterEgg: false },
      { slug: 'mastra', label: 'Mastra', easterEgg: false },
      { slug: 'posthog', label: 'PostHog', easterEgg: false },
      { slug: 'docker', label: 'Docker', easterEgg: false },
    ]);
    expect(nopillo.visibleSlugs).toEqual([
      'typescript',
      'elysia',
      'solidjs',
      'mastra',
      'posthog',
      'docker',
    ]);
    expect(nopillo.hiddenSlugs).toEqual(['ocr', 'agentic-development']);
  });

  it('une expérience non-pause ignore stackLabel (l’API le sert aussi pour la pile)', () => {
    const nopillo = experienceOf(cvFr, 'nopillo');

    expect(nopillo.stackLabel).toContain('TypeScript');
    expect(bySlug('nopillo').stack.some((chip) => chip.easterEgg)).toBe(false);
  });

  it('sans employeur ni lieu, l’organisation est nulle et la ligne vide', () => {
    const bare = {
      ...experienceOf(cvFr, 'nopillo'),
      company: null,
      location: null,
      workMode: null,
      contractType: null,
    };

    const [view] = mapExperiences([bare], 'fr', labels);

    expect(view?.organisation).toBeNull();
    expect(view?.prefix).toBe('@');
    expect(view?.meta).toBe('');
  });

  it('les mots-clés cachés viennent des technos liées non affichées', () => {
    expect(bySlug('contentsquare').hiddenSlugs).toEqual([
      'google-analytics',
      'adobe-analytics',
      'production-operations',
    ]);
  });
});

describe('mapTechs', () => {
  const techsView = () => mapTechs(cvFr.skillGroups);

  it('garde les groupes de l’API avec leurs technos au format du filtre', () => {
    const techs = techsView();
    expect(techs.groups.map((group) => group.slug)).toEqual([
      'languages-frameworks',
      'data-messaging',
      'integration-etl',
      'analytics',
      'applied-ai',
      'devops',
      'practices',
    ]);
    expect(techs.groups[0]?.name).toBe('Langages et frameworks');
    expect(techs.groups[0]?.techs[0]).toEqual({
      slug: 'typescript',
      name: 'TypeScript',
      groupSlug: 'languages-frameworks',
      mainStackOrder: 1,
    });
    expect(techs.groups[1]?.techs[5]).toEqual({
      slug: 'mongodb',
      name: 'MongoDB',
      groupSlug: 'data-messaging',
      mainStackOrder: null,
    });
  });

  it('calcule N : toutes les technos publiées, dans l’ordre des groupes', () => {
    const techs = techsView();
    const expected = cvFr.skillGroups.flatMap((group) => group.skills.map((skill) => skill.slug));

    expect(techs.all.map((tech) => tech.slug)).toEqual(expected);
    expect(techs.total).toBe(expected.length);
    expect(techs.total).toBe(techs.groups.reduce((sum, group) => sum + group.techs.length, 0));
  });

  it('trie la stack principale par rang', () => {
    const techs = techsView();
    expect(techs.mainStack.map((tech) => tech.slug)).toEqual([
      'typescript',
      'nodejs',
      'nestjs',
      'vuejs',
      'postgresql',
      'kafka',
      'docker',
    ]);
  });

  it('une liste de groupes vide donne des technos vides', () => {
    expect(mapTechs([])).toEqual({ groups: [], all: [], total: 0, mainStack: [] });
  });
});

describe('mapRecommendations', () => {
  it('compose la ligne de contexte et pose la langue de la citation', () => {
    const [first, , third] = mapRecommendations(cvFr.recommendations);

    expect(first).toEqual({
      slug: 'alexis-coudeyras',
      author: 'Alexis Coudeyras',
      role: 'CTO',
      context: 'Responsable direct de Julien · 8 décembre 2025',
      paragraphs: cvFr.recommendations[0]?.paragraphs,
      lang: 'fr',
    });
    expect(third?.context).toBe('Responsable direct de Julien · 25 septembre 2020');
  });

  it('sur la page anglaise, la citation reste française : lang fr et date dans sa langue', () => {
    const views = mapRecommendations(cvEn.recommendations);

    expect(views.map((view) => view.lang)).toEqual(['fr', 'fr', 'fr']);
    expect(views[1]?.context).toBe('Responsable direct de Julien · 4 novembre 2020');
  });

  it('une citation traduite en anglais est datée et marquée en anglais', () => {
    const translated = cvFr.recommendations.map((recommendation) => ({
      ...recommendation,
      relationship: 'Direct manager',
      locale: 'en' as const,
    }));

    const [view] = mapRecommendations(translated);

    expect(view?.context).toBe('Direct manager · December 8, 2025');
    expect(view?.lang).toBe('en');
  });

  it('aucune recommandation publiée : liste vide', () => {
    expect(mapRecommendations([])).toEqual([]);
  });
});

describe('mapAi', () => {
  it('reprend les blocs et les étiquettes', () => {
    expect(mapAi(cvFr.aiOverview)).toEqual({
      title: 'L’IA, dans le produit et au quotidien',
      inProduct: {
        label: 'dans le produit · Nopillo, 2026',
        items: [
          'OCR pour les tickets de caisse et les factures',
          'Remplissage automatique des déclarations fiscales',
          'Cadrage et premiers développements d’une IA agentique de recommandation fiscale',
        ],
      },
      daily: {
        label: 'au quotidien',
        text: 'Usage quotidien de l’IA dans ma pratique de développement, développement agentique avec Mastra, veille technique active.',
      },
      tags: [
        { slug: 'mastra', name: 'Mastra' },
        { slug: 'agentic-development', name: 'Développement agentique' },
      ],
    });
  });

  it('la section absente donne null', () => {
    expect(mapAi(null)).toBeNull();
  });
});

describe('mapCv', () => {
  it('assemble toutes les sections dans la langue servie', () => {
    const view = mapCv(cvEn, labels);

    expect(view.locale).toBe('en');
    expect(view.profile).toEqual(mapProfile(cvEn.profile));
    expect(view.links).toEqual(mapLinks(cvEn.socialLinks));
    expect(view.experiences).toEqual(mapExperiences(cvEn.experiences, 'en', labels));
    expect(view.experiences[0]?.period).toBe('Jan 2026 – May 2026');
    expect(view.techs).toEqual(mapTechs(cvEn.skillGroups));
    expect(view.recommendations).toEqual(mapRecommendations(cvEn.recommendations));
    expect(view.ai).toEqual(mapAi(cvEn.aiOverview));
  });

  it('une section IA absente et aucune recommandation restent des états vides', () => {
    const view = mapCv({ ...cvFr, aiOverview: null, recommendations: [] }, labels);

    expect(view.ai).toBeNull();
    expect(view.recommendations).toEqual([]);
    expect(view.experiences).toHaveLength(8);
  });
});
