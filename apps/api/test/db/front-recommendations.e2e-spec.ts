import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  listDeletedEntities,
  purgeDeletedEntities,
} from '../../src/infrastructure/db/deleted-entities.js';
import { runSeeds } from '../../src/infrastructure/db/seeds-runner.js';
import {
  migrationsDirectory,
  openTestSql,
  resetTestDatabase,
  seedsDirectory,
  testDatabaseUrl,
} from '../support/database.js';

/** BF-4 (brief back-001) : tables recommendations et recommendations_translations. */
describe('recommandations (BF-4)', () => {
  let sql: Sql;
  let workDirectory: string;

  const run = (directory: string, log: (line: string) => void = () => undefined) =>
    runSeeds({ databaseUrl: testDatabaseUrl(), directory, migrationsDirectory, log });

  /** Copie les seeds dans un dossier temporaire en appliquant `edit` au fichier des recommandations. */
  async function seedsWith(edit: (content: string) => string): Promise<string> {
    const directory = join(workDirectory, 'seeds');
    await rm(directory, { recursive: true, force: true });
    await cp(seedsDirectory, directory, { recursive: true });
    const path = join(directory, '0006_recommendations.sql');
    await writeFile(path, edit(await readFile(path, 'utf8')));
    return directory;
  }

  /** Les seeds sans la recommandation d'Eric Bisceglia (fiche et traduction). */
  const withoutBisceglia = () =>
    seedsWith((content) =>
      content
        .replace(",\n  ('eric-bisceglia', 'Eric Bisceglia', '2020-09-25', 3, true)", '')
        .replace(/-- eric-bisceglia\ninsert into[^;]*;/, ''),
    );

  const bisceglia = async () =>
    (
      await sql<{ deleted_at: Date | null; translations: number }[]>`
        select r.deleted_at,
          (select count(*)::int from recommendations_translations t where t.recommendation_id = r.id) as translations
        from recommendations r where r.slug = 'eric-bisceglia'`
    )[0];

  const insertRecommendation = async (slug: string) => {
    await sql`
      insert into recommendations (slug, author_name, recommended_on)
      values (${slug}, 'Auteur', '2024-01-01')`;
  };

  const insertTranslation = (slug: string, locale: string, paragraphs: string) =>
    sql`
      insert into recommendations_translations
        (recommendation_id, locale, author_role, relationship, paragraphs)
      select id, ${locale}, 'Rôle', 'Relation', ${sql.unsafe(paragraphs)}
      from recommendations where slug = ${slug}`;

  beforeAll(() => {
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await resetTestDatabase();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-front-recos-'));
    return async () => {
      await rm(workDirectory, { recursive: true, force: true });
    };
  });

  describe('contraintes', () => {
    it('accepte une recommandation complète et ses valeurs par défaut', async () => {
      await insertRecommendation('t-defaut');
      await insertTranslation('t-defaut', 'fr', `array['Un paragraphe']`);

      const [row] = await sql<{ sort_order: number; published: boolean; deleted_at: null }[]>`
        select sort_order, published, deleted_at from recommendations where slug = 't-defaut'`;
      expect(row).toEqual({ sort_order: 0, published: true, deleted_at: null });
    });

    it('refuse un slug en double, un nom d’auteur vide et une date absente', async () => {
      await insertRecommendation('t-unique');

      await expect(insertRecommendation('t-unique')).rejects.toThrow(/recommendations_slug_key/);
      await expect(sql`
        insert into recommendations (slug, author_name, recommended_on)
        values ('t-sans-nom', '', '2024-01-01')`).rejects.toThrow(
        /recommendations_author_name_check/,
      );
      await expect(sql`
        insert into recommendations (slug, author_name, recommended_on)
        values ('t-sans-date', 'Auteur', null)`).rejects.toThrow(/recommended_on/);
    });

    it('refuse un rôle ou une relation vides', async () => {
      await insertRecommendation('t-vides');

      await expect(sql`
        insert into recommendations_translations
          (recommendation_id, locale, author_role, relationship, paragraphs)
        select id, 'fr', '', 'Relation', array['P'] from recommendations where slug = 't-vides'`).rejects.toThrow(
        /recommendations_translations_author_role_check/,
      );
      await expect(sql`
        insert into recommendations_translations
          (recommendation_id, locale, author_role, relationship, paragraphs)
        select id, 'fr', 'Rôle', '', array['P'] from recommendations where slug = 't-vides'`).rejects.toThrow(
        /recommendations_translations_relationship_check/,
      );
    });

    it('refuse des paragraphes absents, vides, ou contenant un élément vide ou nul', async () => {
      await insertRecommendation('t-paragraphes');

      for (const paragraphs of [`'{}'::text[]`, `array['A', '']`, `array['A', null]`]) {
        await expect(insertTranslation('t-paragraphes', 'fr', paragraphs)).rejects.toThrow(
          /recommendations_translations_paragraphs_check/,
        );
      }
      await expect(insertTranslation('t-paragraphes', 'fr', 'null')).rejects.toThrow(/paragraphs/);
    });

    it('refuse une locale hors fr/en et une seconde traduction de la même langue', async () => {
      await insertRecommendation('t-locale');
      await insertTranslation('t-locale', 'fr', `array['A']`);

      await expect(insertTranslation('t-locale', 'de', `array['A']`)).rejects.toThrow(
        /locale_code_check/,
      );
      await expect(insertTranslation('t-locale', 'fr', `array['B']`)).rejects.toThrow(
        /recommendations_translations_pkey/,
      );
      await insertTranslation('t-locale', 'en', `array['A']`);
    });

    it('supprime les traductions en cascade avec la recommandation', async () => {
      await insertRecommendation('t-cascade');
      await insertTranslation('t-cascade', 'fr', `array['A']`);

      await sql`delete from recommendations where slug = 't-cascade'`;

      const rows = await sql`
        select 1 from recommendations_translations where author_role = 'Rôle'`;
      expect(rows).toHaveLength(0);
    });
  });

  describe('seed', () => {
    it('seede les trois recommandations du handoff, publiées, dans l’ordre', async () => {
      const rows = await sql<
        { slug: string; author_name: string; recommended_on: string; sort_order: number }[]
      >`
        select slug, author_name, recommended_on::text, sort_order, published
        from recommendations where published and deleted_at is null order by sort_order`;

      expect(rows).toEqual([
        {
          slug: 'alexis-coudeyras',
          author_name: 'Alexis Coudeyras',
          recommended_on: '2025-12-08',
          sort_order: 1,
          published: true,
        },
        {
          slug: 'steeve-chevry',
          author_name: 'Steeve Chevry',
          recommended_on: '2020-11-04',
          sort_order: 2,
          published: true,
        },
        {
          slug: 'eric-bisceglia',
          author_name: 'Eric Bisceglia',
          recommended_on: '2020-09-25',
          sort_order: 3,
          published: true,
        },
      ]);
    });

    it('ne seede qu’une traduction fr par recommandation, avec la relation du brief', async () => {
      const rows = await sql<
        { slug: string; locale: string; author_role: string; relationship: string; count: number }[]
      >`
        select r.slug, t.locale, t.author_role, t.relationship, cardinality(t.paragraphs)::int as count
        from recommendations r join recommendations_translations t on t.recommendation_id = r.id
        order by r.sort_order`;

      expect(rows).toEqual([
        {
          slug: 'alexis-coudeyras',
          locale: 'fr',
          author_role: 'CTO',
          relationship: 'Responsable direct de Julien',
          count: 6,
        },
        {
          slug: 'steeve-chevry',
          locale: 'fr',
          author_role: 'CTO de transition & CTO as a service',
          relationship: 'Responsable direct de Julien',
          count: 4,
        },
        {
          slug: 'eric-bisceglia',
          locale: 'fr',
          author_role: 'Consulting technique',
          relationship: 'Responsable direct de Julien',
          count: 1,
        },
      ]);
    });

    it('reprend les citations à l’identique, coquilles du handoff comprises', async () => {
      const [chevry] = await sql<{ paragraphs: string[] }[]>`
        select t.paragraphs from recommendations_translations t
        join recommendations r on r.id = t.recommendation_id where r.slug = 'steeve-chevry'`;
      const [coudeyras] = await sql<{ paragraphs: string[] }[]>`
        select t.paragraphs from recommendations_translations t
        join recommendations r on r.id = t.recommendation_id where r.slug = 'alexis-coudeyras'`;

      expect(chevry?.paragraphs[1]).toBe(
        "Il a sur faire preuve de sérieux, d'investissement et a été curieux et intéressé même par les aspects les moins excitants de ses responsabilités.",
      );
      expect(chevry?.paragraphs[3]).toContain('ce qui est une vrai force');
      expect(coudeyras?.paragraphs.at(-1)).toBe(
        'Cette mission a été un gros succès pour Contentsquare.',
      );
    });

    it('accepte une entité publiée sans traduction en : le seed passe, le repli sert le fr', async () => {
      const [row] = await sql<{ count: number }[]>`
        select count(*)::int as count from recommendations_translations where locale = 'en'`;

      expect(row?.count).toBe(0);
      await expect(run(seedsDirectory)).resolves.toBeDefined();
    });

    it('refuse une recommandation publiée sans traduction fr, sans rien appliquer', async () => {
      const directory = await seedsWith(
        (content) =>
          `${content}\ninsert into recommendations (slug, author_name, recommended_on, sort_order, published)
           values ('t-sans-fr', 'Auteur', '2024-01-01', 4, true)
           on conflict (slug) do update set author_name = excluded.author_name;`,
      );

      await expect(run(directory)).rejects.toThrow(
        /Traduction fr manquante.*recommendations\/t-sans-fr/,
      );
      const rows = await sql`select 1 from recommendations where slug = 't-sans-fr'`;
      expect(rows).toHaveLength(0);
    });

    it('ne contrôle pas une recommandation non publiée sans traduction fr', async () => {
      const directory = await seedsWith(
        (content) =>
          `${content}\ninsert into recommendations (slug, author_name, recommended_on, sort_order, published)
           values ('t-brouillon', 'Auteur', '2024-01-01', 4, false)
           on conflict (slug) do update set author_name = excluded.author_name;`,
      );

      await expect(run(directory)).resolves.toBeDefined();
    });
  });

  describe('soft delete et convergence', () => {
    it('marque supprimée, sans la supprimer, une recommandation retirée des seeds', async () => {
      const lines: string[] = [];

      await run(await withoutBisceglia(), (line) => lines.push(line));

      const row = await bisceglia();
      expect(row?.deleted_at).toBeInstanceOf(Date);
      expect(row?.translations).toBe(1);
      expect(
        lines.some(
          (line) =>
            line.includes(
              'recommendations : 1 entité(s) absente(s) des seeds marquée(s) supprimée(s)',
            ) && line.includes('eric-bisceglia'),
        ),
      ).toBe(true);
    });

    it('remet en service une recommandation qui réapparaît dans les seeds', async () => {
      await run(await withoutBisceglia());
      const lines: string[] = [];

      await run(seedsDirectory, (line) => lines.push(line));

      expect((await bisceglia())?.deleted_at).toBeNull();
      expect(lines.join('\n')).toContain(
        'recommendations : 1 entité(s) réapparue(s) dans les seeds, remise(s) en service (eric-bisceglia)',
      );
    });

    it('supprime une traduction ajoutée à la main et absente des seeds', async () => {
      await insertTranslation('eric-bisceglia', 'en', `array['Translation']`);
      const lines: string[] = [];

      await run(seedsDirectory, (line) => lines.push(line));

      const rows = await sql`
        select 1 from recommendations_translations t
        join recommendations r on r.id = t.recommendation_id
        where r.slug = 'eric-bisceglia' and t.locale = 'en'`;
      expect(rows).toHaveLength(0);
      expect(lines.join('\n')).toContain(
        'recommendations_translations : 1 ligne(s) absente(s) des seeds supprimée(s)',
      );
    });

    it('db:deleted:list nomme la recommandation marquée, db:deleted:purge la supprime avec ses traductions', async () => {
      await run(await withoutBisceglia());
      await sql`update recommendations set deleted_at = now() - interval '10 days' where slug = 'eric-bisceglia'`;
      const lines: string[] = [];
      const log = (line: string) => lines.push(line);

      const listed = await listDeletedEntities({ databaseUrl: testDatabaseUrl(), log });
      const purged = await purgeDeletedEntities({
        databaseUrl: testDatabaseUrl(),
        log,
        olderThanDays: 5,
        confirm: true,
      });

      expect(listed.map((entity) => `${entity.table}/${entity.label}`)).toEqual([
        'recommendations/eric-bisceglia',
      ]);
      expect(purged).toBe(1);
      expect(await bisceglia()).toBeUndefined();
      expect(await sql`select 1 from recommendations_translations`).toHaveLength(2);
    });
  });
});
