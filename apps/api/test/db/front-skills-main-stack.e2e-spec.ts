import { type Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from '../support/database.js';

/** BF-3 (brief back-001) : skills.main_stack_order, la stack principale du site. */
describe('stack principale des compétences (BF-3)', () => {
  let sql: Sql;

  beforeAll(() => {
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  const groupId = async () =>
    (await sql<{ id: number }[]>`select id from skill_groups where slug = 'practices'`)[0]?.id;

  it('seede les sept compétences de la stack principale, dans l’ordre du brief', async () => {
    const rows = await sql<{ slug: string; main_stack_order: number }[]>`
      select slug, main_stack_order from skills
      where main_stack_order is not null order by main_stack_order`;

    expect(rows.map((row) => `${row.main_stack_order}:${row.slug}`)).toEqual([
      '1:typescript',
      '2:nodejs',
      '3:nestjs',
      '4:vuejs',
      '5:postgresql',
      '6:kafka',
      '7:docker',
    ]);
  });

  it('laisse null le rang de toutes les autres compétences', async () => {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from skills where main_stack_order is null`;
    const [total] = await sql<{ count: number }[]>`select count(*)::int as count from skills`;

    expect(row?.count).toBe((total?.count ?? 0) - 7);
  });

  it('refuse deux compétences au même rang (index unique partiel)', async () => {
    const id = await groupId();

    await expect(sql`
      insert into skills (slug, group_id, level, icon, main_stack_order)
      values ('t-doublon', ${id ?? 0}, 3, 'x', 1)`).rejects.toThrow(/skills_main_stack_order_idx/);
  });

  it('accepte plusieurs compétences sans rang (null n’est pas unique)', async () => {
    const id = await groupId();

    await sql`
      insert into skills (slug, group_id, level, icon, main_stack_order)
      values ('t-sans-rang-1', ${id ?? 0}, 3, 'x', null), ('t-sans-rang-2', ${id ?? 0}, 3, 'x', null)`;

    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from skills where slug like 't-sans-rang-%'`;
    expect(row?.count).toBe(2);
  });

  it('refuse un rang nul ou négatif (check), accepte un rang libre', async () => {
    const id = await groupId();

    for (const rank of [0, -1]) {
      await expect(sql`
        insert into skills (slug, group_id, level, icon, main_stack_order)
        values ('t-rang', ${id ?? 0}, 3, 'x', ${rank})`).rejects.toThrow(
        /skills_main_stack_order_check/,
      );
    }
    await sql`
      insert into skills (slug, group_id, level, icon, main_stack_order)
      values ('t-rang-libre', ${id ?? 0}, 3, 'x', 8)`;
    const [row] = await sql<{ main_stack_order: number }[]>`
      select main_stack_order from skills where slug = 't-rang-libre'`;
    expect(row?.main_stack_order).toBe(8);
  });

  it('libère un rang quand sa compétence repasse à null', async () => {
    const id = await groupId();
    await sql`update skills set main_stack_order = null where slug = 'docker'`;

    await sql`
      insert into skills (slug, group_id, level, icon, main_stack_order)
      values ('t-reprise', ${id ?? 0}, 3, 'x', 7)`;

    const [row] = await sql<{ main_stack_order: number }[]>`
      select main_stack_order from skills where slug = 't-reprise'`;
    expect(row?.main_stack_order).toBe(7);
  });

  it('renomme en français « Cloud managé » et « Diagnostic en production », sans toucher aux autres noms', async () => {
    const rows = await sql<{ slug: string; locale: string; name: string }[]>`
      select s.slug, t.locale, t.name from skills s join skills_translations t on t.skill_id = s.id
      where s.slug in ('managed-cloud-deployment', 'production-operations', 'agile', 'vuejs')
      order by s.slug, t.locale`;

    expect(rows).toEqual([
      { slug: 'agile', locale: 'en', name: 'Agile methods' },
      { slug: 'agile', locale: 'fr', name: 'Méthodes agiles' },
      { slug: 'managed-cloud-deployment', locale: 'en', name: 'Managed cloud' },
      { slug: 'managed-cloud-deployment', locale: 'fr', name: 'Cloud managé' },
      { slug: 'production-operations', locale: 'en', name: 'Production diagnosis' },
      { slug: 'production-operations', locale: 'fr', name: 'Diagnostic en production' },
      { slug: 'vuejs', locale: 'en', name: 'Vue.js (2 and 3)' },
      { slug: 'vuejs', locale: 'fr', name: 'Vue.js (2 et 3)' },
    ]);
  });
});
