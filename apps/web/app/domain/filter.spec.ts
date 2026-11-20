import { describe, expect, it } from 'vitest';

import {
  type FilterExperience,
  type FilterTech,
  type Suggestion,
  addTech,
  announceResults,
  experiencesWithAll,
  filterExperiences,
  firstValidSuggestion,
  hasTech,
  mainStack,
  normalizeQuery,
  parseTechParam,
  removeLastTech,
  removeTech,
  serializeTechParam,
  suggest,
  techCounter,
  techCounters,
  toggleTech,
} from './filter.js';

// Données du handoff v6 (SPEC § 5, `B-v6-desktop.dc.html`) : huit expériences, technos affichées en
// puces et mots-clés cachés. Les technos sont listées dans un ordre qui n'est pas celui de la
// stack principale, pour prouver que les tris viennent du rang et non de l'ordre d'entrée.
function tech(
  slug: string,
  name: string,
  groupSlug: string,
  rank: number | null = null,
): FilterTech {
  return { slug, name, groupSlug, mainStackOrder: rank };
}

const techs: FilterTech[] = [
  tech('docker', 'Docker', 'outils', 7),
  tech('php', 'PHP', 'langages'),
  tech('typescript', 'TypeScript', 'langages', 1),
  tech('javascript', 'JavaScript', 'langages'),
  tech('node-js', 'Node.js', 'runtimes', 2),
  tech('kafka', 'Kafka', 'donnees', 6),
  tech('nestjs', 'NestJS', 'frameworks', 3),
  tech('vue-js', 'Vue.js', 'frameworks', 4),
  tech('postgresql', 'PostgreSQL', 'donnees', 5),
  tech('streamsets', 'StreamSets', 'donnees'),
  tech('mysql', 'MySQL', 'donnees'),
  tech('css', 'CSS', 'langages'),
  tech('rest-api', 'REST API', 'pratiques'),
  tech('production-diagnosis', 'Diagnostic en production', 'pratiques'),
  tech('agentic-dev', 'Développement agentique', 'ia'),
  tech('ocr', 'OCR', 'ia'),
  tech('git', 'Git', 'pratiques'),
];

function xp(slug: string, visible: string[], hidden: string[] = []): FilterExperience {
  return { slug, visibleSlugs: visible, hiddenSlugs: hidden };
}

const experiences: FilterExperience[] = [
  xp(
    'nopillo',
    ['typescript', 'elysia-js', 'solid-js', 'mastra', 'posthog', 'docker'],
    ['ocr', 'agentic-dev'],
  ),
  xp('pause-professionnelle', []),
  xp(
    'contentsquare',
    ['typescript', 'nestjs', 'vue-js', 'postgresql', 'kafka', 'redis', 'docker'],
    ['google-analytics', 'adobe-analytics', 'production-diagnosis'],
  ),
  xp(
    'wynd-run',
    ['php', 'streamsets', 'rabbitmq', 'mysql', 'magento', 'docker'],
    ['rest-api', 'production-diagnosis'],
  ),
  xp('wynd-etl', ['streamsets', 'kafka', 'rabbitmq', 'mysql', 'docker']),
  xp('leboncoin', ['php', 'javascript']),
  xp('afluens', ['php', 'javascript', 'node-js', 'mongodb', 'html5', 'css'], ['rest-api']),
  xp('openclassrooms', ['php', 'javascript', 'html5', 'css']),
];

const slugsOf = (entries: readonly { experience: FilterExperience }[]): string[] =>
  entries.map((entry) => entry.experience.slug);

describe('hasTech', () => {
  it('reconnaît une techno affichée en puce', () => {
    expect(hasTech(xp('a', ['php']), 'php')).toBe(true);
  });

  it('reconnaît un mot-clé caché', () => {
    expect(hasTech(xp('a', ['php'], ['ocr']), 'ocr')).toBe(true);
  });

  it('refuse une techno absente et compare le slug, pas le libellé', () => {
    expect(hasTech(xp('a', ['php'], ['ocr']), 'kafka')).toBe(false);
    expect(hasTech(xp('a', ['node-js']), 'Node.js')).toBe(false);
  });
});

describe('experiencesWithAll', () => {
  it('rend toutes les expériences sans techno demandée', () => {
    expect(experiencesWithAll(experiences, [])).toHaveLength(8);
  });

  it('exige toutes les technos (ET strict)', () => {
    expect(experiencesWithAll(experiences, ['kafka', 'docker']).map((e) => e.slug)).toEqual([
      'contentsquare',
      'wynd-etl',
    ]);
  });
});

describe('filterExperiences', () => {
  it('sans filtre, affiche les huit expériences dans l’ordre d’origine, rien ailleurs', () => {
    const result = filterExperiences(experiences, []);
    expect(result.active).toBe(false);
    expect(slugsOf(result.full)).toEqual(experiences.map((e) => e.slug));
    expect(result.full.every((entry) => entry.matched.length === 0)).toBe(true);
    expect(result.partial).toEqual([]);
    expect(result.none).toEqual([]);
  });

  it('php est relié à quatre expériences, les autres tombent dans « aucune »', () => {
    const result = filterExperiences(experiences, ['php']);
    expect(result.active).toBe(true);
    expect(slugsOf(result.full)).toEqual(['wynd-run', 'leboncoin', 'afluens', 'openclassrooms']);
    expect(result.full.map((entry) => entry.matched)).toEqual([['php'], ['php'], ['php'], ['php']]);
    expect(result.partial).toEqual([]);
    expect(slugsOf(result.none)).toEqual([
      'nopillo',
      'pause-professionnelle',
      'contentsquare',
      'wynd-etl',
    ]);
    expect(result.none.every((entry) => entry.matched.length === 0)).toBe(true);
  });

  it('range les correspondances partielles avec les technos correspondantes, dans l’ordre du filtre', () => {
    const result = filterExperiences(experiences, ['docker', 'kafka', 'typescript']);
    expect(slugsOf(result.full)).toEqual(['contentsquare']);
    expect(result.full[0]?.matched).toEqual(['docker', 'kafka', 'typescript']);
    expect(slugsOf(result.partial)).toEqual(['nopillo', 'wynd-run', 'wynd-etl']);
    expect(result.partial.map((entry) => entry.matched)).toEqual([
      ['docker', 'typescript'],
      ['docker'],
      ['docker', 'kafka'],
    ]);
    expect(slugsOf(result.none)).toEqual([
      'pause-professionnelle',
      'leboncoin',
      'afluens',
      'openclassrooms',
    ]);
  });

  it('le ET qui donne 0 : plus aucune expérience ne combine tout, toutes passent en partie ou aucune', () => {
    const result = filterExperiences(experiences, ['typescript', 'php']);
    expect(result.full).toEqual([]);
    expect(slugsOf(result.partial)).toEqual([
      'nopillo',
      'contentsquare',
      'wynd-run',
      'leboncoin',
      'afluens',
      'openclassrooms',
    ]);
    expect(slugsOf(result.none)).toEqual(['pause-professionnelle', 'wynd-etl']);
  });

  it('compte les mots-clés cachés comme des technos', () => {
    expect(slugsOf(filterExperiences(experiences, ['ocr']).full)).toEqual(['nopillo']);
    expect(slugsOf(filterExperiences(experiences, ['production-diagnosis']).full)).toEqual([
      'contentsquare',
      'wynd-run',
    ]);
    expect(slugsOf(filterExperiences(experiences, ['rest-api', 'php']).full)).toEqual([
      'wynd-run',
      'afluens',
    ]);
  });

  it('conserve le type des expériences fournies', () => {
    const titled = experiences.map((e) => ({ ...e, title: `Poste ${e.slug}` }));
    expect(filterExperiences(titled, ['ocr']).full[0]?.experience.title).toBe('Poste nopillo');
  });

  it('ignore une techno inconnue des expériences : le ET ne donne rien', () => {
    const result = filterExperiences(experiences, ['inconnue']);
    expect(result.full).toEqual([]);
    expect(result.partial).toEqual([]);
    expect(result.none).toHaveLength(8);
  });
});

describe('techCounter', () => {
  it('compte les expériences d’une techno disponible (php : quatre)', () => {
    expect(techCounter(experiences, [], 'php')).toEqual({
      slug: 'php',
      state: 'available',
      count: 4,
      total: 4,
      selectable: true,
    });
  });

  it('compte les mots-clés cachés (rest-api : deux)', () => {
    expect(techCounter(experiences, [], 'rest-api')).toMatchObject({ count: 2, total: 2 });
  });

  it('donne le nombre d’expériences restantes si on ajoute la techno', () => {
    expect(techCounter(experiences, ['docker'], 'kafka')).toEqual({
      slug: 'kafka',
      state: 'available',
      count: 2,
      total: 2,
      selectable: true,
    });
    expect(techCounter(experiences, ['docker'], 'typescript')).toMatchObject({
      count: 2,
      total: 2,
    });
    expect(techCounter(experiences, ['typescript'], 'streamsets')).toMatchObject({
      state: 'disabled',
      count: 0,
      total: 2,
    });
  });

  it('donne le résultat courant d’une techno déjà choisie', () => {
    expect(techCounter(experiences, ['docker'], 'docker')).toEqual({
      slug: 'docker',
      state: 'selected',
      count: 4,
      total: 4,
      selectable: true,
    });
    expect(techCounter(experiences, ['kafka', 'docker'], 'docker')).toMatchObject({
      state: 'selected',
      count: 2,
    });
  });

  it('désactive une techno qui donnerait 0 résultat (typescript puis php)', () => {
    expect(techCounter(experiences, ['typescript'], 'php')).toEqual({
      slug: 'php',
      state: 'disabled',
      count: 0,
      total: 4,
      selectable: false,
    });
  });

  it('marque une techno sans expérience détaillée, cliquable jamais', () => {
    expect(techCounter(experiences, [], 'git')).toEqual({
      slug: 'git',
      state: 'unlinked',
      count: 0,
      total: 0,
      selectable: false,
    });
    expect(techCounter(experiences, ['php'], 'git').state).toBe('unlinked');
  });

  it('permet de retirer une techno choisie même si le filtre ne donne rien', () => {
    expect(techCounter(experiences, ['typescript', 'php'], 'php')).toMatchObject({
      state: 'selected',
      count: 0,
      selectable: true,
    });
  });
});

describe('techCounters', () => {
  it('rend un compteur par techno, dans l’ordre donné', () => {
    const counters = techCounters(techs, experiences, ['typescript']);
    expect(counters.map((c) => c.slug)).toEqual(techs.map((t) => t.slug));
    expect(counters.find((c) => c.slug === 'typescript')?.state).toBe('selected');
    expect(counters.find((c) => c.slug === 'php')?.state).toBe('disabled');
    expect(counters.find((c) => c.slug === 'docker')).toMatchObject({
      state: 'available',
      count: 2,
    });
    expect(counters.find((c) => c.slug === 'git')?.state).toBe('unlinked');
  });
});

describe('mainStack', () => {
  it('garde les technos de la stack principale, triées par rang', () => {
    expect(mainStack(techs).map((t) => t.slug)).toEqual([
      'typescript',
      'node-js',
      'nestjs',
      'vue-js',
      'postgresql',
      'kafka',
      'docker',
    ]);
  });

  it('ne modifie pas la liste d’origine', () => {
    const copy = [...techs];
    mainStack(techs);
    expect(techs).toEqual(copy);
  });

  it('rend une liste vide sans stack principale', () => {
    expect(mainStack([tech('git', 'Git', 'pratiques')])).toEqual([]);
  });

  it('garde l’ordre d’origine à rang égal', () => {
    const tied = [tech('b', 'B', 'g', 1), tech('a', 'A', 'g', 1), tech('c', 'C', 'g', 0)];
    expect(mainStack(tied).map((t) => t.slug)).toEqual(['c', 'b', 'a']);
  });
});

describe('normalizeQuery', () => {
  it('retire la casse, les accents et les espaces de bord', () => {
    expect(normalizeQuery('  TyPeScript ')).toBe('typescript');
    expect(normalizeQuery('Développement Évolué À l’œuvre')).toBe('developpement evolue a l’œuvre');
  });

  it('garde les espaces internes et la ponctuation', () => {
    expect(normalizeQuery('node .js')).toBe('node .js');
  });
});

describe('suggest', () => {
  const names = (suggestions: readonly Suggestion[]): string[] =>
    suggestions.map((s) => s.tech.name);

  it('ne suggère rien pour une saisie vide ou blanche', () => {
    expect(suggest('', techs, experiences, [])).toEqual([]);
    expect(suggest('   ', techs, experiences, [])).toEqual([]);
  });

  it('cherche dans le nom, sans casse', () => {
    expect(names(suggest('SCRIPT', techs, experiences, []))).toEqual(['JavaScript', 'TypeScript']);
    expect(names(suggest('node', techs, experiences, []))).toEqual(['Node.js']);
  });

  it('ignore les accents de la saisie et du nom', () => {
    expect(names(suggest('developpement', techs, experiences, []))).toEqual([
      'Développement agentique',
    ]);
    expect(names(suggest('DÉVELOPPEMENT', techs, experiences, []))).toEqual([
      'Développement agentique',
    ]);
  });

  it('exclut les technos déjà choisies', () => {
    expect(names(suggest('script', techs, experiences, ['typescript']))).toEqual(['JavaScript']);
  });

  it('trie par nombre d’expériences puis garde l’ordre d’origine, six au plus', () => {
    const result = suggest('s', techs, experiences, []);
    expect(names(result)).toEqual([
      'JavaScript',
      'TypeScript',
      'StreamSets',
      'MySQL',
      'CSS',
      'REST API',
    ]);
    expect(result.map((s) => s.total)).toEqual([3, 2, 2, 2, 2, 2]);
  });

  it('départage à nombre égal par le rang de stack principale, les technos sans rang après', () => {
    const list = [
      tech('php', 'Tech PHP', 'langages'),
      tech('kafka', 'Tech Kafka', 'donnees', 6),
      tech('docker', 'Tech Docker', 'outils', 7),
    ];
    expect(names(suggest('tech', list, experiences, []))).toEqual([
      'Tech Docker',
      'Tech PHP',
      'Tech Kafka',
    ]);
    const ranked = [tech('php', 'Tech PHP', 'langages', 9), ...list.slice(2)];
    expect(names(suggest('tech', ranked, experiences, []))).toEqual(['Tech Docker', 'Tech PHP']);
    const reversed = [
      tech('docker', 'Tech Docker', 'outils', 9),
      tech('php', 'Tech PHP', 'langages', 2),
    ];
    expect(names(suggest('tech', reversed, experiences, []))).toEqual(['Tech PHP', 'Tech Docker']);
  });

  it('respecte la limite demandée', () => {
    expect(names(suggest('s', techs, experiences, [], 2))).toEqual(['JavaScript', 'TypeScript']);
  });

  it('porte le compteur, l’état et la techno de chaque suggestion', () => {
    const [first] = suggest('php', techs, experiences, ['typescript']);
    expect(first).toEqual({
      tech: techs[1],
      slug: 'php',
      state: 'disabled',
      count: 0,
      total: 4,
      selectable: false,
    });
    expect(suggest('kafka', techs, experiences, ['docker'])[0]).toMatchObject({
      state: 'available',
      count: 2,
    });
    expect(suggest('git', techs, experiences, [])[0]).toMatchObject({
      state: 'unlinked',
      total: 0,
    });
  });

  it('rend une liste vide si rien ne correspond', () => {
    expect(suggest('zzz', techs, experiences, [])).toEqual([]);
  });
});

describe('firstValidSuggestion', () => {
  it('saute les technos désactivées et sans expérience (Entrée)', () => {
    const list = [
      tech('php', 'Alpha PHP', 'langages', 1),
      tech('docker', 'Alpha Docker', 'outils', 7),
      tech('git', 'Alpha Git', 'pratiques'),
    ];
    const suggestions = suggest('alpha', list, experiences, ['typescript', 'kafka']);
    expect(suggestions.map((s) => s.state)).toEqual(['disabled', 'available', 'unlinked']);
    expect(firstValidSuggestion(suggestions)?.slug).toBe('docker');
  });

  it('rend undefined si aucune suggestion n’est utilisable', () => {
    expect(
      firstValidSuggestion(suggest('php', techs, experiences, ['typescript'])),
    ).toBeUndefined();
    expect(firstValidSuggestion([])).toBeUndefined();
  });
});

describe('ajout et retrait', () => {
  it('ajoute à la fin, sans doublon : le même tableau si rien ne change', () => {
    const selected = ['php'];
    expect(addTech(selected, 'kafka')).toEqual(['php', 'kafka']);
    expect(selected).toEqual(['php']);
    expect(addTech(selected, 'php')).toBe(selected);
  });

  it('retire une techno, sans effet (même tableau) si elle manque', () => {
    const selected = ['php', 'kafka', 'docker'];
    expect(removeTech(selected, 'kafka')).toEqual(['php', 'docker']);
    expect(selected).toEqual(['php', 'kafka', 'docker']);
    expect(removeTech(selected, 'git')).toBe(selected);
  });

  it('bascule : ajoute si absente, retire si présente', () => {
    expect(toggleTech([], 'php')).toEqual(['php']);
    expect(toggleTech(['php', 'kafka'], 'php')).toEqual(['kafka']);
  });

  it('retire la dernière puce, rien sur une liste vide', () => {
    expect(removeLastTech(['php', 'kafka'])).toEqual(['php']);
    expect(removeLastTech(['php'])).toEqual([]);
    expect(removeLastTech([])).toEqual([]);
  });
});

describe('paramètre d’URL ?tech=', () => {
  const known = techs.map((t) => t.slug);

  it('lit une liste de slugs dans l’ordre', () => {
    expect(parseTechParam('kafka,typescript', known)).toEqual(['kafka', 'typescript']);
  });

  it('ignore les slugs inconnus et les éléments vides', () => {
    expect(parseTechParam('kafka,inconnue,,typescript,', known)).toEqual(['kafka', 'typescript']);
  });

  it('retire les doublons en gardant la première occurrence', () => {
    expect(parseTechParam('kafka,php,kafka,php,docker', known)).toEqual(['kafka', 'php', 'docker']);
  });

  it('tolère des espaces autour des slugs', () => {
    expect(parseTechParam(' kafka , php ', known)).toEqual(['kafka', 'php']);
  });

  it('distingue la casse : un slug est en minuscules', () => {
    expect(parseTechParam('Kafka', known)).toEqual([]);
  });

  it('lit un paramètre répété comme une seule liste', () => {
    expect(parseTechParam(['kafka', 'php,kafka', null], known)).toEqual(['kafka', 'php']);
  });

  it('rend une liste vide sans paramètre', () => {
    expect(parseTechParam(undefined, known)).toEqual([]);
    expect(parseTechParam(null, known)).toEqual([]);
    expect(parseTechParam('', known)).toEqual([]);
    expect(parseTechParam([], known)).toEqual([]);
  });

  it('écrit la liste séparée par des virgules, undefined si elle est vide', () => {
    expect(serializeTechParam(['kafka', 'typescript'])).toBe('kafka,typescript');
    expect(serializeTechParam(['kafka'])).toBe('kafka');
    expect(serializeTechParam([])).toBeUndefined();
  });

  it('relit ce qu’il a écrit', () => {
    const selected = ['typescript', 'kafka', 'docker'];
    expect(parseTechParam(serializeTechParam(selected), known)).toEqual(selected);
  });
});

describe('announceResults', () => {
  it('sans filtre : les huit expériences', () => {
    expect(announceResults(experiences, [])).toEqual({
      kind: 'all',
      count: 8,
      others: 0,
      filters: 0,
    });
  });

  it('avec résultats : le nombre d’expériences qui combinent tout et celles repliées', () => {
    expect(announceResults(experiences, ['php'])).toEqual({
      kind: 'results',
      count: 4,
      others: 4,
      filters: 1,
    });
    expect(announceResults(experiences, ['kafka', 'docker'])).toEqual({
      kind: 'results',
      count: 2,
      others: 6,
      filters: 2,
    });
  });

  it('quand le ET ne donne rien : zéro résultat, toutes les expériences en retrait', () => {
    expect(announceResults(experiences, ['typescript', 'php'])).toEqual({
      kind: 'empty',
      count: 0,
      others: 8,
      filters: 2,
    });
  });
});
