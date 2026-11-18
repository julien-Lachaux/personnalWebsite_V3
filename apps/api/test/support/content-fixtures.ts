import { type Sql } from 'postgres';

/**
 * Une ligne publiée, traduite en `fr` ET en `en`, dans chacune des trois tables vides en seed
 * (`projects`, `tools`, `resources`) : permet d'exercer ces routes avec du contenu.
 * À utiliser dans le `setup` de `withFixture` (slugs `qa-*`, nettoyés par lui).
 */
export async function insertEmptySeedTablesFixtures(sql: Sql): Promise<void> {
  await sql`insert into projects (slug, year, sort_order) values ('qa-projet', 2024, 1)`;
  await sql`
    insert into projects_translations (project_id, locale, title, description)
    select id, l.locale, 'Projet ' || l.locale, 'Description ' || l.locale
    from projects, (values ('fr'), ('en')) as l(locale) where slug = 'qa-projet'`;
  await sql`insert into tools (slug, sort_order) values ('qa-outil', 1)`;
  await sql`
    insert into tools_translations (tool_id, locale, name, family, description)
    select id, l.locale, 'Outil ' || l.locale, 'Famille ' || l.locale, 'Description ' || l.locale
    from tools, (values ('fr'), ('en')) as l(locale) where slug = 'qa-outil'`;
  await sql`insert into resources (slug, url, sort_order) values ('qa-ressource', 'https://example.org', 1)`;
  await sql`
    insert into resources_translations (resource_id, locale, name, description)
    select id, l.locale, 'Ressource ' || l.locale, 'Description ' || l.locale
    from resources, (values ('fr'), ('en')) as l(locale) where slug = 'qa-ressource'`;
}
