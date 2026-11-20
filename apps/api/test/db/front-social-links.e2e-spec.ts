import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from '../support/database.js';

/** BF-6 (brief back-001) : lien vers les recommandations publiées sur LinkedIn. */
describe('lien des recommandations LinkedIn (BF-6)', () => {
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it('seede le lien linkedin-recommendations, de kind linkedin, publié, après le lien linkedin', async () => {
    const rows = await sql<
      { slug: string; kind: string; url: string; sort_order: number; published: boolean }[]
    >`
      select slug, kind, url, sort_order, published from social_links
      where deleted_at is null order by sort_order`;

    expect(rows).toEqual([
      {
        slug: 'linkedin',
        kind: 'linkedin',
        url: 'https://www.linkedin.com/in/julien-lachaux',
        sort_order: 1,
        published: true,
      },
      {
        slug: 'linkedin-recommendations',
        kind: 'linkedin',
        url: 'https://www.linkedin.com/in/julien-lachaux/details/recommendations/',
        sort_order: 2,
        published: true,
      },
    ]);
  });

  it('seede ses libellés français et anglais', async () => {
    const rows = await sql<{ locale: string; label: string }[]>`
      select t.locale, t.label from social_links_translations t
      join social_links l on l.id = t.social_link_id
      where l.slug = 'linkedin-recommendations' order by t.locale`;

    expect(rows).toEqual([
      { locale: 'en', label: 'Recommendations published on LinkedIn' },
      { locale: 'fr', label: 'Recommandations publiées sur LinkedIn' },
    ]);
  });
});
