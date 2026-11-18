import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withFixture } from './support/fixtures.js';
import { startTestApp } from './support/test-app.js';

interface RowOptions {
  published: boolean;
  sortOrder: number;
  /** Index unique du test, pour les colonnes uniques hors slug (code de langue). */
  index: number;
}

interface ResourceSpec {
  /** Route de liste. */
  path: string;
  /** Clé dans `/cv` ; `null` pour `skills`, qui n'y figurent qu'imbriquées dans `skillGroups`. */
  cvKey: string | null;
  /** Table de base et clé étrangère de sa table de traductions. */
  table: string;
  foreignKey: string;
  /** Colonnes propres à la ressource, hors slug / sort_order / published. */
  base: (sql: Sql, index: number) => Promise<Record<string, unknown>>;
  /** Colonnes de traduction `fr`. */
  translation: Record<string, unknown>;
}

const SPECS: ResourceSpec[] = [
  {
    path: '/api/v1/social-links',
    cvKey: 'socialLinks',
    table: 'social_links',
    foreignKey: 'social_link_id',
    base: () => Promise.resolve({ kind: 'test', url: 'https://example.org' }),
    translation: { label: 'Lien' },
  },
  {
    path: '/api/v1/skill-groups',
    cvKey: 'skillGroups',
    table: 'skill_groups',
    foreignKey: 'skill_group_id',
    base: () => Promise.resolve({}),
    translation: { name: 'Groupe' },
  },
  {
    path: '/api/v1/skills',
    cvKey: null,
    table: 'skills',
    foreignKey: 'skill_id',
    base: async (sql) => {
      // Groupe publié, placé avant tous les autres : les compétences de test sortent en tête.
      await sql`
        insert into skill_groups (slug, sort_order, published)
        values ('qa-groupe-parent', -100, true) on conflict (slug) do nothing`;
      await sql`
        insert into skill_groups_translations (skill_group_id, locale, name)
        select id, 'fr', 'Groupe parent' from skill_groups where slug = 'qa-groupe-parent'
        on conflict do nothing`;
      const [group] = await sql<{ id: number }[]>`
        select id from skill_groups where slug = 'qa-groupe-parent'`;
      return { group_id: group?.id, level: 3, icon: 'test' };
    },
    translation: { name: 'Compétence' },
  },
  {
    path: '/api/v1/experiences',
    cvKey: 'experiences',
    table: 'experiences',
    foreignKey: 'experience_id',
    base: () =>
      Promise.resolve({ kind: 'freelance', company: 'Société', date_start: '2099-01-01' }),
    translation: { job_title: 'Poste', summary: 'Résumé' },
  },
  {
    path: '/api/v1/projects',
    cvKey: 'projects',
    table: 'projects',
    foreignKey: 'project_id',
    base: () => Promise.resolve({ year: 2024 }),
    translation: { title: 'Projet', description: 'Description' },
  },
  {
    path: '/api/v1/tools',
    cvKey: 'tools',
    table: 'tools',
    foreignKey: 'tool_id',
    base: () => Promise.resolve({}),
    translation: { name: 'Outil', family: 'Famille', description: 'Description' },
  },
  {
    path: '/api/v1/resources',
    cvKey: 'resources',
    table: 'resources',
    foreignKey: 'resource_id',
    base: () => Promise.resolve({ url: 'https://example.org' }),
    translation: { name: 'Ressource', description: 'Description' },
  },
  {
    path: '/api/v1/certifications',
    cvKey: 'certifications',
    table: 'certifications',
    foreignKey: 'certification_id',
    base: () => Promise.resolve({ issuer: 'Organisme', year: 2024 }),
    translation: { name: 'Certification' },
  },
  {
    path: '/api/v1/education',
    cvKey: 'education',
    table: 'education',
    foreignKey: 'education_id',
    base: () => Promise.resolve({ institution: 'École', year_start: 2010 }),
    translation: { title: 'Diplôme' },
  },
  {
    path: '/api/v1/languages',
    cvKey: 'languages',
    table: 'languages',
    foreignKey: 'language_id',
    // `code` : deux lettres minuscules et unique (qa, qb, qc…).
    base: (_sql, index) => Promise.resolve({ code: `q${String.fromCharCode(97 + index)}` }),
    translation: { name: 'Langue', level_label: 'niveau' },
  },
];

async function insertRow(
  sql: Sql,
  spec: ResourceSpec,
  slug: string,
  options: RowOptions,
): Promise<void> {
  const base = {
    ...(await spec.base(sql, options.index)),
    slug,
    sort_order: options.sortOrder,
    published: options.published,
  };
  const [row] = await sql<{ id: number }[]>`
    insert into ${sql(spec.table)} ${sql(base)} returning id`;
  await sql`
    insert into ${sql(`${spec.table}_translations`)} ${sql({
      [spec.foreignKey]: row?.id,
      locale: 'fr',
      ...spec.translation,
    })}`;
}

async function setSortOrder(sql: Sql, spec: ResourceSpec, slug: string, sortOrder: number) {
  await sql`update ${sql(spec.table)} set sort_order = ${sortOrder} where slug = ${slug}`;
}

describe('Filtrage published et ordre de tri', () => {
  let app: NestFastifyApplication;
  const previousMax = process.env['RATE_LIMIT_MAX'];

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX'] = '100000';
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    if (previousMax === undefined) {
      delete process.env['RATE_LIMIT_MAX'];
    } else {
      process.env['RATE_LIMIT_MAX'] = previousMax;
    }
  });

  /** Slugs de fixtures (`qa-`) d'une réponse de liste, dans l'ordre de la réponse. */
  async function routeSlugs(path: string): Promise<string[]> {
    const response = await app.inject({ method: 'GET', url: path });
    expect(response.statusCode).toBe(200);
    return response
      .json<{ slug: string }[]>()
      .map((item) => item.slug)
      .filter((slug) => slug.startsWith('qa-'));
  }

  /** Slugs de fixtures dans `/cv` pour la même ressource (compétences : imbriquées). */
  async function cvSlugs(spec: ResourceSpec): Promise<string[]> {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cv' });
    expect(response.statusCode).toBe(200);
    const cv = response.json<Record<string, { slug: string; skills?: { slug: string }[] }[]>>();
    const items =
      spec.cvKey === null
        ? (cv['skillGroups'] ?? []).flatMap((group) => group.skills ?? [])
        : (cv[spec.cvKey] ?? []);
    return items.map((item) => item.slug).filter((slug) => slug.startsWith('qa-'));
  }

  it('couvre les 10 ressources en liste', () => {
    expect(SPECS).toHaveLength(10);
  });

  describe.each(SPECS)('$path', (spec) => {
    it('une ligne non publiée n’apparaît ni dans la route ni dans /cv', async () => {
      await withFixture(
        async (sql) => {
          await insertRow(sql, spec, 'qa-visible', { published: true, sortOrder: -2, index: 0 });
          await insertRow(sql, spec, 'qa-masquee', { published: false, sortOrder: -3, index: 1 });
        },
        async () => {
          expect(await routeSlugs(spec.path)).toEqual(['qa-visible']);
          expect(await cvSlugs(spec)).toEqual(['qa-visible']);
        },
      );
    });

    it('un sort_order modifié change l’ordre de la liste et du /cv', async () => {
      // Les expériences se trient d'abord par date : voir le test dédié plus bas.
      if (spec.table === 'experiences') {
        return;
      }
      await withFixture(
        async (sql) => {
          await insertRow(sql, spec, 'qa-a', { published: true, sortOrder: -2, index: 0 });
          await insertRow(sql, spec, 'qa-b', { published: true, sortOrder: -1, index: 1 });
        },
        async (sql) => {
          expect(await routeSlugs(spec.path)).toEqual(['qa-a', 'qa-b']);
          expect(await cvSlugs(spec)).toEqual(['qa-a', 'qa-b']);

          await setSortOrder(sql, spec, 'qa-a', 3);
          await setSortOrder(sql, spec, 'qa-b', 2);

          expect(await routeSlugs(spec.path)).toEqual(['qa-b', 'qa-a']);
          expect(await cvSlugs(spec)).toEqual(['qa-b', 'qa-a']);
        },
      );
    });
  });

  describe('experiences : tri dateStart décroissant', () => {
    const experiences = SPECS.find((spec) => spec.table === 'experiences')!;

    it('la date prime sur sort_order ; à date égale, sort_order départage', async () => {
      await withFixture(
        async (sql) => {
          await insertRow(sql, experiences, 'qa-ancienne', {
            published: true,
            sortOrder: -9,
            index: 0,
          });
          await sql`update experiences set date_start = '2098-01-01' where slug = 'qa-ancienne'`;
          await insertRow(sql, experiences, 'qa-recente', {
            published: true,
            sortOrder: 9,
            index: 1,
          });
          await sql`update experiences set date_start = '2099-06-01' where slug = 'qa-recente'`;
          await insertRow(sql, experiences, 'qa-egale-2', {
            published: true,
            sortOrder: 2,
            index: 2,
          });
          await insertRow(sql, experiences, 'qa-egale-1', {
            published: true,
            sortOrder: 1,
            index: 3,
          });
          await sql`update experiences set date_start = '2098-06-01' where slug like 'qa-egale-%'`;
        },
        async () => {
          const expected = ['qa-recente', 'qa-egale-1', 'qa-egale-2', 'qa-ancienne'];
          expect(await routeSlugs(experiences.path)).toEqual(expected);
          expect(await cvSlugs(experiences)).toEqual(expected);
        },
      );
    });

    it('sur la base seedée, les dates sont strictement décroissantes (ou égales)', async () => {
      const response = await app.inject({ method: 'GET', url: experiences.path });
      const dates = response.json<{ dateStart: string }[]>().map((item) => item.dateStart);

      expect(dates).toEqual([...dates].sort().reverse());
    });
  });

  describe('compétences', () => {
    const skills = SPECS.find((spec) => spec.table === 'skills')!;

    it('une compétence publiée d’un groupe non publié disparaît de /skills, /skill-groups et /cv', async () => {
      await withFixture(
        async (sql) => {
          await sql`insert into skill_groups (slug, sort_order, published) values ('qa-groupe-cache', -50, false)`;
          await sql`
            insert into skill_groups_translations (skill_group_id, locale, name)
            select id, 'fr', 'Groupe caché' from skill_groups where slug = 'qa-groupe-cache'`;
          await sql`
            insert into skills (slug, group_id, level, icon, published)
            select 'qa-orpheline', id, 3, 'test', true from skill_groups where slug = 'qa-groupe-cache'`;
          await sql`
            insert into skills_translations (skill_id, locale, name)
            select id, 'fr', 'Orpheline' from skills where slug = 'qa-orpheline'`;
        },
        async () => {
          expect(await routeSlugs(skills.path)).toEqual([]);
          expect(await routeSlugs('/api/v1/skill-groups')).toEqual([]);
          expect(await cvSlugs(skills)).toEqual([]);
        },
      );
    });

    it('une compétence non publiée disparaît des compétences imbriquées des projets et des expériences', async () => {
      await withFixture(
        async (sql) => {
          await insertRow(sql, skills, 'qa-competence-cachee', {
            published: false,
            sortOrder: 0,
            index: 0,
          });
          await insertRow(
            sql,
            SPECS.find((spec) => spec.table === 'projects')!,
            'qa-projet',
            {
              published: true,
              sortOrder: -1,
              index: 0,
            },
          );
          await insertRow(
            sql,
            SPECS.find((spec) => spec.table === 'experiences')!,
            'qa-xp',
            {
              published: true,
              sortOrder: -1,
              index: 0,
            },
          );
          await sql`
            insert into project_skills (project_id, skill_id)
            select p.id, s.id from projects p, skills s
            where p.slug = 'qa-projet' and s.slug = 'qa-competence-cachee'`;
          await sql`
            insert into experience_skills (experience_id, skill_id)
            select e.id, s.id from experiences e, skills s
            where e.slug = 'qa-xp' and s.slug = 'qa-competence-cachee'`;
        },
        async () => {
          for (const path of ['/api/v1/projects', '/api/v1/experiences']) {
            const items = (await app.inject({ method: 'GET', url: path })).json<
              { slug: string; skills: unknown[] }[]
            >();
            const fixture = items.find((item) => item.slug.startsWith('qa-'));
            expect(fixture, path).toBeDefined();
            expect(fixture?.skills, path).toEqual([]);
          }
        },
      );
    });
  });
});
