import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from '../support/database.js';

describe('contraintes du schéma SQL', () => {
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it('met group_id à null quand le groupe référencé par une ressource est supprimé', async () => {
    await sql`insert into skill_groups (slug) values ('t-groupe-ressource')`;
    await sql`
      insert into resources (slug, url, group_id)
      select 't-ressource', 'https://example.test', id from skill_groups
      where slug = 't-groupe-ressource'`;

    await sql`delete from skill_groups where slug = 't-groupe-ressource'`;

    const rows = await sql<{ group_id: number | null }[]>`
      select group_id from resources where slug = 't-ressource'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.group_id).toBeNull();
    await sql`delete from resources where slug = 't-ressource'`;
  });

  it('refuse de supprimer un groupe qui contient des compétences', async () => {
    await sql`insert into skill_groups (slug) values ('t-groupe-skill')`;
    await sql`
      insert into skills (slug, group_id, level, icon)
      select 't-skill', id, 3, 't-skill' from skill_groups where slug = 't-groupe-skill'`;

    await expect(sql`delete from skill_groups where slug = 't-groupe-skill'`).rejects.toThrow(
      /foreign key/i,
    );

    await sql`delete from skills where slug = 't-skill'`;
    await sql`delete from skill_groups where slug = 't-groupe-skill'`;
  });

  it('refuse un niveau de compétence hors de 1 à 5', async () => {
    await sql`insert into skill_groups (slug) values ('t-groupe-niveau')`;
    await expect(sql`
      insert into skills (slug, group_id, level, icon)
      select 't-niveau', id, 6, 'x' from skill_groups where slug = 't-groupe-niveau'`).rejects.toThrow(
      /skills_level_check/,
    );
    await sql`delete from skill_groups where slug = 't-groupe-niveau'`;
  });

  it('refuse une pause avec employeur et des dates inversées', async () => {
    await expect(sql`
      insert into experiences (slug, kind, company, date_start)
      values ('t-pause', 'break', 'Société', '2024-04-01')`).rejects.toThrow(
      /experiences_break_company_check/,
    );
    await expect(sql`
      insert into experiences (slug, kind, date_start, date_end)
      values ('t-dates', 'employment', '2024-04-01', '2024-03-01')`).rejects.toThrow(
      /experiences_dates_check/,
    );
  });

  it('refuse une locale hors fr/en, un code de langue de trois lettres et un niveau CECRL inconnu', async () => {
    await expect(sql`
      insert into profile_translations
        (profile_id, locale, title, headline, bio, availability, picture_alt)
      values (1, 'de', 't', 'h', 'b', 'a', 'p')`).rejects.toThrow(/locale_code_check/);
    await expect(sql`insert into languages (slug, code) values ('t-fra', 'fra')`).rejects.toThrow(
      /languages_code_check/,
    );
    await expect(
      sql`insert into languages (slug, code, cefr_level) values ('t-z9', 'zz', 'Z9')`,
    ).rejects.toThrow(/languages_cefr_level_check/);
  });

  it('refuse une seconde ligne de profil', async () => {
    await expect(sql`
      insert into profile (id, first_name, last_name, picture_path, location)
      values (2, 'a', 'b', 'c', 'd')`).rejects.toThrow(/profile_id_check|check constraint/);
  });

  it('refuse un chemin d’image ou un texte alternatif vide (le contrat Image les exige non vides)', async () => {
    await expect(sql`update profile_translations set picture_alt = ''`).rejects.toThrow(
      /profile_translations_picture_alt_check/,
    );
    await expect(sql`update profile set picture_path = ''`).rejects.toThrow(
      /profile_picture_path_check/,
    );
    await expect(sql`update experiences_translations set logo_alt = ''`).rejects.toThrow(
      /experiences_translations_logo_alt_check/,
    );
    await expect(sql`update experiences set logo_path = ''`).rejects.toThrow(
      /experiences_logo_path_check/,
    );

    await sql`insert into projects (slug) values ('t-projet-image')`;
    await sql`insert into resources (slug, url) values ('t-ressource-image', 'https://example.test')`;
    try {
      await expect(
        sql`update projects set image_desktop_path = '' where slug = 't-projet-image'`,
      ).rejects.toThrow(/projects_image_desktop_path_check/);
      await expect(
        sql`update projects set image_mobile_path = '' where slug = 't-projet-image'`,
      ).rejects.toThrow(/projects_image_mobile_path_check/);
      await expect(
        sql`update resources set picture_path = '' where slug = 't-ressource-image'`,
      ).rejects.toThrow(/resources_picture_path_check/);
      await expect(sql`
        insert into projects_translations (project_id, locale, title, description, image_alt)
        select id, 'fr', 't', 'd', '' from projects where slug = 't-projet-image'`).rejects.toThrow(
        /projects_translations_image_alt_check/,
      );
      await expect(sql`
        insert into resources_translations (resource_id, locale, name, description, picture_alt)
        select id, 'fr', 'n', 'd', '' from resources where slug = 't-ressource-image'`).rejects.toThrow(
        /resources_translations_picture_alt_check/,
      );
    } finally {
      await sql`delete from projects where slug = 't-projet-image'`;
      await sql`delete from resources where slug = 't-ressource-image'`;
    }
  });
});
