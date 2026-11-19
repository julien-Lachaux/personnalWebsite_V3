import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Sql } from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSeeds } from '../../src/infrastructure/db/seeds-runner.js';
import {
  migrationsDirectory,
  openTestSql,
  resetTestDatabase,
  seedsDirectory,
  testDatabaseUrl,
} from '../support/database.js';

/**
 * Convergence par soft delete (DEC-4, docs/01) : une entité écrite par les seeds qui disparaît des
 * fichiers est marquée `deleted_at = now()` (à la place de l'ancien avertissement « conservée »),
 * remise à `null` si elle réapparaît ; ses traductions et liaisons restent en base.
 */
describe('seeds et soft delete', () => {
  let sql: Sql;
  let workDirectory: string;

  const run = (directory: string, log: (line: string) => void = () => undefined) =>
    runSeeds({ databaseUrl: testDatabaseUrl(), directory, migrationsDirectory, log });

  /** Copie les seeds dans un dossier temporaire en appliquant `edit` au contenu d'un fichier. */
  async function seedsWith(file: string, edit: (content: string) => string): Promise<string> {
    const directory = join(workDirectory, 'seeds');
    await rm(directory, { recursive: true, force: true });
    await cp(seedsDirectory, directory, { recursive: true });
    const path = join(directory, file);
    await writeFile(path, edit(await readFile(path, 'utf8')));
    return directory;
  }

  /** Les seeds sans la formation « autodidacte » (fiche, traductions fr et en). */
  const withoutAutodidacte = () =>
    seedsWith('0005_certifications_education_languages.sql', (content) =>
      content
        .replace(
          "  ('openclassrooms-integrateur-web', 'OpenClassrooms', 2015, 2015, null, 2, true),\n  ('autodidacte', 'Autodidacte', 2015, null, null, 3, true)",
          "  ('openclassrooms-integrateur-web', 'OpenClassrooms', 2015, 2015, null, 2, true)",
        )
        .replace(
          /insert into education_translations[^;]*?where p\.slug = 'autodidacte'\s*on conflict[^;]*;/g,
          '',
        ),
    );

  const autodidacte = async () =>
    (
      await sql<{ deleted_at: Date | null; translations: number }[]>`
        select e.deleted_at,
          (select count(*)::int from education_translations t where t.education_id = e.id) as translations
        from education e where e.slug = 'autodidacte'`
    )[0];

  beforeEach(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-soft-delete-'));
  });

  afterEach(async () => {
    await sql.end({ timeout: 5 });
    await rm(workDirectory, { recursive: true, force: true });
  });

  it('marque deleted_at sur une entité retirée des fichiers, sans la supprimer ni toucher à ses traductions', async () => {
    const lines: string[] = [];
    const directory = await withoutAutodidacte();

    await run(directory, (line) => lines.push(line));

    const row = await autodidacte();
    expect(row?.deleted_at).toBeInstanceOf(Date);
    expect(row?.translations).toBe(2);
    const log = lines.join('\n');
    expect(log).toContain('education : 1 entité(s) absente(s) des seeds marquée(s) supprimée(s)');
    expect(log).toContain('autodidacte');
    expect(log).not.toContain('ATTENTION');
  });

  it('ne touche pas aux entités encore présentes dans les fichiers', async () => {
    await run(await withoutAutodidacte());

    const rows = await sql<{ slug: string; deleted_at: Date | null }[]>`
      select slug, deleted_at from education where slug <> 'autodidacte' order by slug`;
    expect(rows.map((row) => row.deleted_at)).toEqual([null, null]);
  });

  it('un second passage ne change ni la date ni le journal : l’entité est déjà marquée', async () => {
    const directory = await withoutAutodidacte();
    await run(directory);
    const first = (await autodidacte())?.deleted_at;
    const lines: string[] = [];

    await run(directory, (line) => lines.push(line));

    expect((await autodidacte())?.deleted_at).toEqual(first);
    expect(lines.join('\n')).not.toContain('marquée(s) supprimée(s)');
  });

  it('démarque l’entité quand elle réapparaît dans les fichiers, et la remet en service', async () => {
    await run(await withoutAutodidacte());
    expect((await autodidacte())?.deleted_at).not.toBeNull();
    const lines: string[] = [];

    await run(seedsDirectory, (line) => lines.push(line));

    expect((await autodidacte())?.deleted_at).toBeNull();
    expect(lines.join('\n')).toContain(
      'education : 1 entité(s) réapparue(s) dans les seeds, remise(s) en service',
    );
  });

  it('démarque aussi une entité seedée marquée à la main', async () => {
    await sql`update certifications set deleted_at = now() where slug = 'ef-set-plus-62'`;

    await run(seedsDirectory);

    const rows = await sql`
      select 1 from certifications where slug = 'ef-set-plus-62' and deleted_at is null`;
    expect(rows).toHaveLength(1);
  });

  it('marque une entité ajoutée à la main et absente des seeds (table écrite par les seeds)', async () => {
    await sql`insert into certifications (slug, issuer, year) values ('qa-retiree', 'Organisme', 2020)`;
    await sql`
      insert into certifications_translations (certification_id, locale, name)
      select id, 'fr', 'Retirée' from certifications where slug = 'qa-retiree'`;

    const lines: string[] = [];
    await run(seedsDirectory, (line) => lines.push(line));

    const rows = await sql<{ deleted_at: Date | null; published: boolean }[]>`
      select deleted_at, published from certifications where slug = 'qa-retiree'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted_at).toBeInstanceOf(Date);
    expect(rows[0]?.published).toBe(true);
    expect(lines.join('\n')).toContain('qa-retiree');
  });

  it('ne touche pas aux tables que les seeds ne mentionnent pas (projets sans seed)', async () => {
    await sql`insert into projects (slug) values ('qa-projet-main')`;
    await sql`
      insert into projects_translations (project_id, locale, title, description)
      select id, 'fr', 'Projet', 'Description' from projects where slug = 'qa-projet-main'`;

    await run(seedsDirectory);

    const rows = await sql`select 1 from projects where deleted_at is null`;
    expect(rows).toHaveLength(1);
  });

  it('ne contrôle plus les traductions d’une entité marquée (fr manquante, en lacunaire)', async () => {
    await sql`
      insert into experiences (slug, kind, company, date_start, deleted_at)
      values ('qa-sans-fr', 'freelance', 'Société', '2020-01-01', now())`;
    await sql`
      insert into experiences_translations (experience_id, locale, job_title, summary)
      select id, 'en', 'Job', 'Summary' from experiences where slug = 'qa-sans-fr'`;

    await expect(run(seedsDirectory)).resolves.toBeDefined();
  });
});
