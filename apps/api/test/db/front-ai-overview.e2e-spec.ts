import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

/** BF-5 (brief back-001) : tables ai_overview, ai_overview_translations et ai_overview_skills. */
describe('section IA (BF-5)', () => {
  let sql: Sql;
  let workDirectory: string;

  const run = (directory: string, log: (line: string) => void = () => undefined) =>
    runSeeds({ databaseUrl: testDatabaseUrl(), directory, migrationsDirectory, log });

  /** Seeds réels + un fichier de seed supplémentaire. */
  async function seedsPlus(statement: string): Promise<string> {
    const directory = join(workDirectory, 'seeds');
    await rm(directory, { recursive: true, force: true });
    await cp(seedsDirectory, directory, { recursive: true });
    await writeFile(join(directory, '0099_supplement.sql'), statement);
    return directory;
  }

  const insertTranslation = (locale: string, items: string) =>
    sql`
      insert into ai_overview_translations
        (ai_overview_id, locale, title, in_product_label, in_product_items, daily_label, daily_text)
      values (1, ${locale}, 'Titre', 'Produit', ${sql.unsafe(items)}, 'Quotidien', 'Texte')`;

  beforeAll(() => {
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await resetTestDatabase();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-front-ai-'));
    return async () => {
      await rm(workDirectory, { recursive: true, force: true });
    };
  });

  describe('contraintes', () => {
    it('refuse toute ligne autre que id = 1', async () => {
      await expect(sql`insert into ai_overview (id) values (2)`).rejects.toThrow(
        /ai_overview_id_check/,
      );
      await expect(sql`insert into ai_overview (id) values (1)`).rejects.toThrow(
        /ai_overview_pkey/,
      );
    });

    it('refuse des points absents, vides, ou contenant un élément vide ou nul', async () => {
      await sql`delete from ai_overview_translations where locale = 'en'`;

      for (const items of [`'{}'::text[]`, `array['A', '']`, `array['A', null]`]) {
        await expect(insertTranslation('en', items)).rejects.toThrow(
          /ai_overview_translations_in_product_items_check/,
        );
      }
      await expect(insertTranslation('en', 'null')).rejects.toThrow(/in_product_items/);
    });

    it('refuse un titre, une étiquette ou un texte vides', async () => {
      await sql`delete from ai_overview_translations where locale = 'en'`;

      for (const [column, check] of [
        ['title', 'ai_overview_translations_title_check'],
        ['in_product_label', 'ai_overview_translations_in_product_label_check'],
        ['daily_label', 'ai_overview_translations_daily_label_check'],
        ['daily_text', 'ai_overview_translations_daily_text_check'],
      ] as const) {
        await expect(
          sql`
            insert into ai_overview_translations
              (ai_overview_id, locale, title, in_product_label, in_product_items, daily_label, daily_text)
            select 1, 'en',
              case when ${column} = 'title' then '' else 'T' end,
              case when ${column} = 'in_product_label' then '' else 'T' end,
              array['A'],
              case when ${column} = 'daily_label' then '' else 'T' end,
              case when ${column} = 'daily_text' then '' else 'T' end`,
        ).rejects.toThrow(new RegExp(check));
      }
    });

    it('refuse une locale hors fr/en et une seconde traduction de la même langue', async () => {
      await expect(insertTranslation('de', `array['A']`)).rejects.toThrow(/locale_code_check/);
      await expect(insertTranslation('fr', `array['A']`)).rejects.toThrow(
        /ai_overview_translations_pkey/,
      );
    });

    it('refuse un doublon de compétence et une compétence inconnue', async () => {
      await expect(sql`
        insert into ai_overview_skills (ai_overview_id, skill_id)
        select 1, id from skills where slug = 'mastra'`).rejects.toThrow(/ai_overview_skills_pkey/);
      await expect(
        sql`insert into ai_overview_skills (ai_overview_id, skill_id) values (1, 999999)`,
      ).rejects.toThrow(/foreign key/i);
    });

    it('supprime la liaison quand la compétence est supprimée, et tout en cascade avec la section', async () => {
      await sql`delete from skills where slug = 'mastra'`;
      const [afterSkill] = await sql<{ count: number }[]>`
        select count(*)::int as count from ai_overview_skills`;

      await sql`delete from ai_overview where id = 1`;

      expect(afterSkill?.count).toBe(1);
      expect(await sql`select 1 from ai_overview_skills`).toHaveLength(0);
      expect(await sql`select 1 from ai_overview_translations`).toHaveLength(0);
    });
  });

  describe('seed', () => {
    it('seede la ligne unique, non marquée supprimée, avec ses deux langues', async () => {
      const rows = await sql<{ id: number; deleted_at: Date | null }[]>`
        select id, deleted_at from ai_overview`;
      const locales = await sql<{ locale: string }[]>`
        select locale from ai_overview_translations order by locale`;

      expect(rows).toEqual([{ id: 1, deleted_at: null }]);
      expect(locales.map((row) => row.locale)).toEqual(['en', 'fr']);
    });

    it('reprend le texte français du handoff, sans le champ todo', async () => {
      const [row] = await sql<
        {
          title: string;
          in_product_label: string;
          in_product_items: string[];
          daily_label: string;
          daily_text: string;
        }[]
      >`select title, in_product_label, in_product_items, daily_label, daily_text
        from ai_overview_translations where locale = 'fr'`;

      expect(row).toEqual({
        title: 'L’IA, dans le produit et au quotidien',
        in_product_label: 'dans le produit · Nopillo, 2026',
        in_product_items: [
          'OCR pour les tickets de caisse et les factures',
          'Remplissage automatique des déclarations fiscales',
          'Cadrage et premiers développements d’une IA agentique de recommandation fiscale',
        ],
        daily_label: 'au quotidien',
        daily_text:
          'Usage quotidien de l’IA dans ma pratique de développement, développement agentique avec Mastra, veille technique active.',
      });
      const todo = await sql`
        select 1 from ai_overview_translations
        where daily_text ilike '%COMPLÉTER%' or array_to_string(in_product_items, ' ') ilike '%COMPLÉTER%'`;
      expect(todo).toHaveLength(0);
    });

    it('lie les étiquettes mastra puis agentic-development, dans cet ordre', async () => {
      const rows = await sql<{ slug: string; sort_order: number }[]>`
        select s.slug, l.sort_order from ai_overview_skills l join skills s on s.id = l.skill_id
        order by l.sort_order`;

      expect(rows).toEqual([
        { slug: 'mastra', sort_order: 1 },
        { slug: 'agentic-development', sort_order: 2 },
      ]);
    });

    it('fournit une traduction en complète, avec le même nombre de points que le fr', async () => {
      const rows = await sql<{ locale: string; count: number }[]>`
        select locale, cardinality(in_product_items)::int as count
        from ai_overview_translations order by locale`;

      expect(rows).toEqual([
        { locale: 'en', count: 3 },
        { locale: 'fr', count: 3 },
      ]);
      await expect(run(seedsDirectory)).resolves.toBeDefined();
    });

    it('accepte une section sans traduction en : le seed passe, le repli sert le fr', async () => {
      const directory = await seedsPlus(
        `insert into ai_overview_translations
           (ai_overview_id, locale, title, in_product_label, in_product_items, daily_label, daily_text)
         values (1, 'fr', 'T', 'P', array['A'], 'Q', 'X')
         on conflict (ai_overview_id, locale) do update set title = excluded.title;
         delete from ai_overview_translations where locale = 'en';`,
      );

      await expect(run(directory)).resolves.toBeDefined();
    });

    it('arrête le déploiement si la section n’a pas de traduction fr, sans rien appliquer', async () => {
      const directory = await seedsPlus(
        `delete from ai_overview_translations where locale = 'fr';`,
      );

      await expect(run(directory)).rejects.toThrow(
        /Traduction fr manquante.*ai_overview\/ai-overview/,
      );
      expect(await sql`select 1 from ai_overview_translations where locale = 'fr'`).toHaveLength(1);
    });
  });

  describe('convergence et soft delete', () => {
    it('supprime une étiquette ajoutée à la main et absente des seeds', async () => {
      await sql`
        insert into ai_overview_skills (ai_overview_id, skill_id, sort_order)
        select 1, id, 3 from skills where slug = 'ocr'`;
      const lines: string[] = [];

      await run(seedsDirectory, (line) => lines.push(line));

      const rows = await sql<{ slug: string }[]>`
        select s.slug from ai_overview_skills l join skills s on s.id = l.skill_id order by l.sort_order`;
      expect(rows.map((row) => row.slug)).toEqual(['mastra', 'agentic-development']);
      expect(lines.join('\n')).toContain(
        'ai_overview_skills : 1 ligne(s) absente(s) des seeds supprimée(s)',
      );
    });

    it('supprime une traduction ajoutée à la main et absente des seeds, en gardant les seeds', async () => {
      await sql`delete from ai_overview_translations where locale = 'en'`;
      await insertTranslation('en', `array['Manuelle']`);

      await run(seedsDirectory);

      const [row] = await sql<{ title: string }[]>`
        select title from ai_overview_translations where locale = 'en'`;
      expect(row?.title).toBe('AI, in the product and day to day');
    });

    it('remet en service la section marquée supprimée, au prochain seed', async () => {
      await sql`update ai_overview set deleted_at = now() where id = 1`;
      const lines: string[] = [];

      await run(seedsDirectory, (line) => lines.push(line));

      const [row] = await sql<{ deleted_at: Date | null }[]>`select deleted_at from ai_overview`;
      expect(row?.deleted_at).toBeNull();
      expect(lines.join('\n')).toContain(
        'ai_overview : 1 entité(s) réapparue(s) dans les seeds, remise(s) en service (ai-overview)',
      );
    });

    it('annule aussi la remise en service quand la traduction fr manque', async () => {
      await sql`update ai_overview set deleted_at = now() where id = 1`;
      const directory = await seedsPlus(
        `delete from ai_overview_translations where locale = 'fr';`,
      );

      await expect(run(directory)).rejects.toThrow(/Traduction fr manquante/);
      expect(await sql`select 1 from ai_overview where deleted_at is not null`).toHaveLength(1);
    });

    it('db:deleted:list nomme la section marquée, db:deleted:purge la supprime avec traductions et étiquettes', async () => {
      await sql`update ai_overview set deleted_at = now() - interval '10 days' where id = 1`;
      const log = () => undefined;

      const listed = await listDeletedEntities({ databaseUrl: testDatabaseUrl(), log });
      const simulated = await purgeDeletedEntities({
        databaseUrl: testDatabaseUrl(),
        log,
        olderThanDays: 5,
        confirm: false,
      });
      const purged = await purgeDeletedEntities({
        databaseUrl: testDatabaseUrl(),
        log,
        olderThanDays: 5,
        confirm: true,
      });

      expect(listed.map((entity) => `${entity.table}/${entity.label}`)).toEqual([
        'ai_overview/ai-overview',
      ]);
      expect(simulated).toBe(0);
      expect(purged).toBe(1);
      expect(await sql`select 1 from ai_overview`).toHaveLength(0);
      expect(await sql`select 1 from ai_overview_translations`).toHaveLength(0);
      expect(await sql`select 1 from ai_overview_skills`).toHaveLength(0);
    });
  });
});
