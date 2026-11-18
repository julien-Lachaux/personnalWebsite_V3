import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertAppliedMatchDisk,
  assertNoTransactionControl,
  computeChecksum,
  listSqlFiles,
} from './migrations-runner.js';

describe('listSqlFiles', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'siteperso-sql-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('trie les fichiers par nom et extrait version et nom', async () => {
    await writeFile(join(directory, '0010_late.sql'), 'select 1;');
    await writeFile(join(directory, '0002_second.sql'), 'select 1;');
    await writeFile(join(directory, '0001_first.sql'), 'select 1;');
    await writeFile(join(directory, 'notes.txt'), 'ignoré');

    const files = await listSqlFiles(directory);

    expect(files.map((file) => file.name)).toEqual(['0001_first', '0002_second', '0010_late']);
    expect(files.map((file) => file.version)).toEqual(['0001', '0002', '0010']);
  });

  it('refuse deux fichiers de même préfixe', async () => {
    await writeFile(join(directory, '0001_a.sql'), 'select 1;');
    await writeFile(join(directory, '0001_b.sql'), 'select 1;');

    await expect(listSqlFiles(directory)).rejects.toThrow(/préfixe 0001/);
  });

  it('refuse un nom de fichier sans préfixe numérique', async () => {
    await writeFile(join(directory, 'init.sql'), 'select 1;');

    await expect(listSqlFiles(directory)).rejects.toThrow(/Nom de fichier SQL invalide/);
  });
});

describe('computeChecksum', () => {
  it('est stable et sensible au moindre changement', () => {
    expect(computeChecksum('select 1;')).toBe(computeChecksum('select 1;'));
    expect(computeChecksum('select 1;')).not.toBe(computeChecksum('select 2;'));
    expect(computeChecksum('select 1;')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('assertNoTransactionControl', () => {
  it.each(['begin', 'commit', 'rollback', 'start transaction', 'end', 'abort'])(
    'refuse « %s »',
    (statement) => {
      expect(() =>
        assertNoTransactionControl('0002_x', `create table t (id int); ${statement};`),
      ).toThrow(/0002_x\.sql contient/);
    },
  );

  it('accepte le mot dans un commentaire, une chaîne ou un corps de fonction', () => {
    const content = `-- commit;
      create table t (label text default 'rollback;');
      create function f() returns int language plpgsql as $$ begin return 1; end; $$;`;

    expect(() => assertNoTransactionControl('0002_x', content)).not.toThrow();
  });
});

describe('assertAppliedMatchDisk', () => {
  const files = [
    { version: '0001', name: '0001_first', path: '/x/0001_first.sql' },
    { version: '0002', name: '0002_second', path: '/x/0002_second.sql' },
  ];

  it('accepte des migrations appliquées présentes sous le même nom', () => {
    expect(() =>
      assertAppliedMatchDisk([{ version: '0001', name: '0001_first' }], files),
    ).not.toThrow();
  });

  it('refuse une migration renommée', () => {
    expect(() => assertAppliedMatchDisk([{ version: '0001', name: '0001_old' }], files)).toThrow(
      /0001 renommée.*0001_old.*0001_first/,
    );
  });

  it('refuse une migration absente du disque', () => {
    expect(() => assertAppliedMatchDisk([{ version: '0003', name: '0003_gone' }], files)).toThrow(
      /0003_gone.*absente du disque/,
    );
  });
});
