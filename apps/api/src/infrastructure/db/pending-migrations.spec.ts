import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Sql } from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findPendingMigrations } from './migrations-runner.js';

/** Fausse connexion : répond à la 1re requête (présence de la table) puis à la 2e (versions). */
function fakeSql(tablePresent: boolean, versions: string[]): Sql {
  const answers: unknown[][] = [
    [{ present: tablePresent }],
    versions.map((version) => ({ version })),
  ];
  return (() => Promise.resolve(answers.shift() ?? [])) as unknown as Sql;
}

describe('findPendingMigrations', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'siteperso-migrations-'));
    await writeFile(join(directory, '0001_a.sql'), 'select 1;');
    await writeFile(join(directory, '0002_b.sql'), 'select 2;');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('liste toutes les migrations quand schema_migrations n’existe pas', async () => {
    await expect(findPendingMigrations(fakeSql(false, []), directory)).resolves.toEqual([
      '0001_a',
      '0002_b',
    ]);
  });

  it('ne liste que celles qui ne sont pas encore enregistrées', async () => {
    await expect(findPendingMigrations(fakeSql(true, ['0001']), directory)).resolves.toEqual([
      '0002_b',
    ]);
  });

  it('renvoie une liste vide quand tout est appliqué', async () => {
    await expect(
      findPendingMigrations(fakeSql(true, ['0001', '0002']), directory),
    ).resolves.toEqual([]);
  });
});
