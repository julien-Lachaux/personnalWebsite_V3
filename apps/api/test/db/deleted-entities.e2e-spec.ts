import { type Sql } from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  listDeletedEntities,
  purgeDeletedEntities,
} from '../../src/infrastructure/db/deleted-entities.js';
import { openTestSql, resetTestDatabase, testDatabaseUrl } from '../support/database.js';

/**
 * Commandes de nettoyage du soft delete (DEC-4, docs/01) : `db:deleted:list` liste les entités
 * marquées, `db:deleted:purge --older-than <jours>` les supprime physiquement, sur confirmation
 * explicite, et jamais en production sans variable d'acquittement.
 */
describe('db:deleted:list et db:deleted:purge', () => {
  let sql: Sql;
  let lines: string[];

  const log = (line: string) => {
    lines.push(line);
  };
  const databaseUrl = () => testDatabaseUrl();
  const count = async (table: string, slug: string) =>
    (
      await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table)} where slug = ${slug}`
    )[0]?.count;

  /** Marque une entité supprimée il y a `days` jours. */
  const markDeleted = (table: string, slug: string, days: number) =>
    sql`update ${sql(table)} set deleted_at = now() - make_interval(days => ${days})
        where slug = ${slug}`;

  beforeEach(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    lines = [];
  });

  afterEach(async () => {
    await sql.end({ timeout: 5 });
    delete process.env['ALLOW_PRODUCTION_PURGE'];
  });

  describe('db:deleted:list', () => {
    it('indique qu’il n’y a rien quand aucune entité n’est marquée', async () => {
      const entities = await listDeletedEntities({ databaseUrl: databaseUrl(), log });

      expect(entities).toEqual([]);
      expect(lines).toEqual(['Aucune entité marquée supprimée.']);
    });

    it('liste par table les entités marquées, avec leur slug et la date de marquage', async () => {
      await markDeleted('education', 'autodidacte', 40);
      await markDeleted('certifications', 'ef-set-plus-62', 3);
      await markDeleted('skills', 'docker', 10);
      await sql`update profile set deleted_at = now() where id = 1`;

      const entities = await listDeletedEntities({ databaseUrl: databaseUrl(), log });

      expect(entities.map((entity) => `${entity.table}/${entity.label}`)).toEqual([
        'profile/profil',
        'skills/docker',
        'certifications/ef-set-plus-62',
        'education/autodidacte',
      ]);
      expect(entities[3]?.deletedAt).toBeInstanceOf(Date);
      expect(lines[0]).toBe('4 entité(s) marquée(s) supprimée(s) :');
      expect(lines[3]).toMatch(
        /^ {2}certifications : ef-set-plus-62 \(supprimée le \d{4}-\d{2}-\d{2}T[\d:.]+Z\)$/,
      );
    });

    it('ne liste ni les entités non marquées ni les entités seulement dépubliées', async () => {
      await sql`update experiences set published = false where slug = 'nopillo'`;

      const entities = await listDeletedEntities({ databaseUrl: databaseUrl(), log });

      expect(entities).toEqual([]);
    });
  });

  describe('db:deleted:purge', () => {
    const purge = (options: { olderThanDays: number; confirm: boolean }) =>
      purgeDeletedEntities({ databaseUrl: databaseUrl(), log, ...options });

    it('sans confirmation : simule, liste ce qui serait supprimé et ne supprime rien', async () => {
      await markDeleted('education', 'autodidacte', 40);

      const purged = await purge({ olderThanDays: 30, confirm: false });

      expect(purged).toBe(0);
      expect(await count('education', 'autodidacte')).toBe(1);
      const log = lines.join('\n');
      expect(log).toContain('Simulation');
      expect(log).toContain('education : 1 entité(s) à supprimer (autodidacte)');
      expect(log).toContain('--confirm');
    });

    it('avec confirmation : supprime physiquement les entités marquées depuis plus de N jours, traductions comprises', async () => {
      await markDeleted('education', 'autodidacte', 40);
      await markDeleted('education', 'eemi', 5);
      await markDeleted('experiences', 'nopillo', 90);

      const purged = await purge({ olderThanDays: 30, confirm: true });

      expect(purged).toBe(2);
      expect(await count('education', 'autodidacte')).toBe(0);
      expect(await count('experiences', 'nopillo')).toBe(0);
      expect(await count('education', 'eemi')).toBe(1);
      const orphans = await sql<{ count: number }[]>`
        select count(*)::int as count from education_translations t
        where not exists (select 1 from education e where e.id = t.education_id)`;
      expect(orphans[0]?.count).toBe(0);
      const links = await sql<{ count: number }[]>`
        select count(*)::int as count from experience_skills l
        where not exists (select 1 from experiences e where e.id = l.experience_id)`;
      expect(links[0]?.count).toBe(0);
      expect(lines.join('\n')).toContain('education : 1 entité(s) supprimée(s) (autodidacte)');
    });

    it('ne supprime jamais une entité non marquée, même très ancienne ou dépubliée', async () => {
      await sql`update education set published = false where slug = 'eemi'`;

      const purged = await purge({ olderThanDays: 0, confirm: true });

      expect(purged).toBe(0);
      expect(await count('education', 'eemi')).toBe(1);
      expect(lines.join('\n')).toContain('Aucune entité');
    });

    it('--older-than 0 supprime tout ce qui est marqué', async () => {
      await markDeleted('languages', 'french', 0);
      await markDeleted('social_links', 'linkedin', 1);

      const purged = await purge({ olderThanDays: 0, confirm: true });

      expect(purged).toBe(2);
      expect(await count('languages', 'french')).toBe(0);
      expect(await count('social_links', 'linkedin')).toBe(0);
    });

    it('supprime un groupe marqué avec ses compétences marquées (compétences d’abord)', async () => {
      await markDeleted('skills', 'postgresql', 40);
      await sql`
        update skills set deleted_at = now() - interval '40 days'
        where group_id = (select id from skill_groups where slug = 'data-messaging')`;
      await markDeleted('skill_groups', 'data-messaging', 40);

      const purged = await purge({ olderThanDays: 30, confirm: true });

      expect(purged).toBeGreaterThanOrEqual(2);
      expect(await count('skill_groups', 'data-messaging')).toBe(0);
      expect(await count('skills', 'postgresql')).toBe(0);
    });

    it('annule tout (aucune suppression) si une suppression viole une clé étrangère', async () => {
      await markDeleted('education', 'autodidacte', 40);
      // Le groupe est marqué mais ses compétences, non : « on delete restrict » refuse la purge.
      await markDeleted('skill_groups', 'data-messaging', 40);

      await expect(purge({ olderThanDays: 30, confirm: true })).rejects.toThrow(
        /Purge annulée \(rien n'a été supprimé\) : .*skill_groups/,
      );
      expect(await count('education', 'autodidacte')).toBe(1);
      expect(await count('skill_groups', 'data-messaging')).toBe(1);
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'refuse un nombre de jours invalide (%s)',
      async (days) => {
        await expect(purge({ olderThanDays: days, confirm: true })).rejects.toThrow(
          /nombre de jours/,
        );
      },
    );

    it('est refusé en production sans variable d’acquittement, et ne supprime rien', async () => {
      await markDeleted('education', 'autodidacte', 40);
      const previous = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      try {
        await expect(purge({ olderThanDays: 30, confirm: true })).rejects.toThrow(
          /refusé en production.*ALLOW_PRODUCTION_PURGE=yes/,
        );
      } finally {
        process.env['NODE_ENV'] = previous;
      }
      expect(await count('education', 'autodidacte')).toBe(1);
    });

    it('en production, ALLOW_PRODUCTION_PURGE=yes acquitte la purge ; toute autre valeur la refuse', async () => {
      await markDeleted('education', 'autodidacte', 40);
      const previous = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      try {
        process.env['ALLOW_PRODUCTION_PURGE'] = 'true';
        await expect(purge({ olderThanDays: 30, confirm: true })).rejects.toThrow(/refusé/);
        process.env['ALLOW_PRODUCTION_PURGE'] = 'yes';
        await expect(purge({ olderThanDays: 30, confirm: true })).resolves.toBe(1);
      } finally {
        process.env['NODE_ENV'] = previous;
      }
      expect(await count('education', 'autodidacte')).toBe(0);
    });

    it('en production, la simulation (sans --confirm) reste permise sans acquittement', async () => {
      const previous = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      try {
        await expect(purge({ olderThanDays: 30, confirm: false })).resolves.toBe(0);
      } finally {
        process.env['NODE_ENV'] = previous;
      }
    });
  });
});
