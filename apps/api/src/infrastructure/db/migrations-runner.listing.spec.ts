import { readdir } from 'node:fs/promises';

import { type Sql } from 'postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertAppliedMatchDisk,
  assertNoTransactionControl,
  findPendingMigrations,
  listSqlFiles,
} from './migrations-runner.js';

// `readdir` rend l'ordre du système de fichiers : on le fixe pour prouver que le tri vient du code.
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readdir: vi.fn(),
}));

const readdirMock = vi.mocked(readdir) as unknown as ReturnType<typeof vi.fn<() => string[]>>;

beforeEach(() => {
  readdirMock.mockReset();
});

describe('listSqlFiles : ordre et nommage', () => {
  it('trie les fichiers par nom quel que soit l’ordre rendu par le système de fichiers', async () => {
    readdirMock.mockResolvedValue([
      '0003_c.sql',
      '0001_a.sql',
      'LISEZMOI.md',
      '0010_d.sql',
      '0002_b.sql',
    ]);

    const files = await listSqlFiles('/migrations');

    expect(files.map((file) => file.name)).toEqual(['0001_a', '0002_b', '0003_c', '0010_d']);
    expect(files[0]).toEqual({ version: '0001', name: '0001_a', path: '/migrations/0001_a.sql' });
  });

  it.each([
    'x0001_a.sql',
    '0001_a.sql.sql',
    '001_a.sql',
    '00001_a.sql',
    '0001_A.sql',
    '0001_a-b.sql',
    '0001_.sql',
    '0001.sql',
  ])('refuse le nom %s', async (name) => {
    readdirMock.mockResolvedValue([name]);

    await expect(listSqlFiles('/migrations')).rejects.toThrow(
      `Nom de fichier SQL invalide : ${name} (attendu NNNN_description.sql).`,
    );
  });

  it('accepte chiffres, lettres minuscules et soulignés dans la description', async () => {
    readdirMock.mockResolvedValue(['0042_ajoute_table_2.sql']);

    await expect(listSqlFiles('/migrations')).resolves.toHaveLength(1);
  });
});

describe('messages d’erreur des garde-fous de migration', () => {
  it('dit comment corriger un fichier qui pilote la transaction', () => {
    expect(() => assertNoTransactionControl('0002_x', 'select 1; commit;')).toThrow(
      '0002_x.sql contient « commit » : le runner gère la transaction, ' +
        'retirer toute instruction de contrôle de transaction du fichier.',
    );
  });

  it('dit que le dépôt ne correspond pas à la base quand une migration appliquée manque', () => {
    expect(() => assertAppliedMatchDisk([{ version: '0003', name: '0003_gone' }], [])).toThrow(
      'Migration 0003_gone (version 0003) appliquée en base mais absente du disque : ' +
        'le dépôt ne correspond pas à la base (fichier supprimé, mauvaise branche ?).',
    );
  });

  it('interdit de renommer une migration appliquée', () => {
    expect(() =>
      assertAppliedMatchDisk(
        [{ version: '0001', name: '0001_old' }],
        [{ version: '0001', name: '0001_new', path: '/x/0001_new.sql' }],
      ),
    ).toThrow(
      'Migration 0001 renommée : appliquée sous le nom 0001_old, présente sous le nom ' +
        '0001_new. Une migration appliquée ne se renomme jamais.',
    );
  });
});

describe('findPendingMigrations : requêtes émises', () => {
  /** Fausse connexion qui garde le texte de chaque requête et répond dans l'ordre. */
  function recordingSql(answers: unknown[][]): { sql: Sql; queries: string[] } {
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray) => {
      queries.push(strings.join('?').replace(/\s+/g, ' ').trim());
      return Promise.resolve(answers.shift() ?? []);
    }) as unknown as Sql;
    return { sql, queries };
  }

  beforeEach(() => {
    readdirMock.mockResolvedValue(['0001_a.sql', '0002_b.sql']);
  });

  it('teste la présence de schema_migrations puis lit les versions appliquées', async () => {
    const { sql, queries } = recordingSql([[{ present: true }], [{ version: '0001' }]]);

    await expect(findPendingMigrations(sql, '/migrations')).resolves.toEqual(['0002_b']);

    expect(queries).toEqual([
      "select to_regclass('public.schema_migrations') is not null as present",
      'select version from schema_migrations',
    ]);
  });

  it('ne lit pas schema_migrations quand la table n’existe pas encore', async () => {
    const { sql, queries } = recordingSql([[{ present: false }], [{ version: '0001' }]]);

    await expect(findPendingMigrations(sql, '/migrations')).resolves.toEqual(['0001_a', '0002_b']);

    expect(queries).toHaveLength(1);
  });
});
