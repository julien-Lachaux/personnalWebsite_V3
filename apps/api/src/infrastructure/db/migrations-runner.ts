import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import postgres, { type Sql } from 'postgres';

import { splitSqlStatements, statementVerb } from './sql-statements.js';

/** Clé du verrou consultatif (`pg_advisory_lock`) qui sérialise les runners de migrations. */
const MIGRATIONS_LOCK_KEY = 7_251_001;

const SQL_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/** Fichier SQL versionné (`NNNN_description.sql`). */
export interface SqlFile {
  /** Préfixe numérique sur quatre chiffres (`0001`). */
  version: string;
  /** Nom du fichier sans l'extension (`0001_enums`). */
  name: string;
  /** Chemin absolu du fichier. */
  path: string;
}

/** Fonction de journal : une ligne par appel, sans saut de ligne final. */
export type LogFn = (line: string) => void;

export interface MigrationsOptions {
  databaseUrl: string;
  /** Répertoire des migrations (`db/migrations`). */
  directory: string;
  log: LogFn;
}

export interface MigrationsResult {
  applied: string[];
  alreadyApplied: string[];
}

/** SHA-256 hexadécimal du contenu d'un fichier SQL. */
export function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Liste les fichiers `NNNN_description.sql` d'un répertoire, triés par nom.
 * Refuse deux fichiers de même préfixe et tout fichier `.sql` mal nommé.
 */
export async function listSqlFiles(directory: string): Promise<SqlFile[]> {
  const entries = (await readdir(directory)).filter((entry) => entry.endsWith('.sql')).sort();
  const files: SqlFile[] = [];
  const byVersion = new Map<string, string>();
  for (const entry of entries) {
    const match = SQL_FILE_PATTERN.exec(entry);
    if (!match) {
      throw new Error(`Nom de fichier SQL invalide : ${entry} (attendu NNNN_description.sql).`);
    }
    const [, version = ''] = match;
    const previous = byVersion.get(version);
    if (previous !== undefined) {
      throw new Error(`Deux fichiers portent le préfixe ${version} : ${previous} et ${entry}.`);
    }
    byVersion.set(version, entry);
    files.push({ version, name: entry.slice(0, -'.sql'.length), path: join(directory, entry) });
  }
  return files;
}

/** Ouvre une connexion unique : le verrou de session et les transactions partagent la même. */
export function openSingleConnection(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 1, onnotice: () => undefined });
}

async function ensureMigrationsTable(sql: Sql): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      version text primary key,
      name text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`;
}

/** Verbes qui pilotent la transaction : interdits dans un fichier, le runner la gère lui-même. */
const TRANSACTION_VERBS = new Set(['begin', 'start', 'commit', 'end', 'rollback', 'abort']);

/**
 * Refuse un fichier de migration qui contient `begin`, `commit`, `rollback`, `start transaction`,
 * `end` ou `abort` (hors commentaires, chaînes et corps de fonction) : le runner exécute le fichier
 * dans sa propre transaction avec l'enregistrement dans `schema_migrations`, et un `commit` du
 * fichier la terminerait. La migration serait alors à moitié appliquée et non enregistrée.
 */
export function assertNoTransactionControl(fileName: string, content: string): void {
  for (const statement of splitSqlStatements(content)) {
    const verb = statementVerb(statement);
    if (TRANSACTION_VERBS.has(verb)) {
      throw new Error(
        `${fileName}.sql contient « ${verb} » : le runner gère la transaction, ` +
          'retirer toute instruction de contrôle de transaction du fichier.',
      );
    }
  }
}

/**
 * Refuse une migration déjà appliquée que le disque ne retrouve plus ou sous un autre nom :
 * fichier supprimé, ou renommé (même version, `name` différent). Les deux trahissent un dépôt
 * qui diverge de la base (mauvaise branche, historique réécrit) ; continuer appliquerait les
 * migrations suivantes sur un schéma que le dépôt ne décrit plus.
 */
export function assertAppliedMatchDisk(
  applied: readonly { version: string; name: string }[],
  files: readonly SqlFile[],
): void {
  const byVersion = new Map(files.map((file) => [file.version, file.name]));
  for (const row of applied) {
    const onDisk = byVersion.get(row.version);
    if (onDisk === undefined) {
      throw new Error(
        `Migration ${row.name} (version ${row.version}) appliquée en base mais absente du disque : ` +
          'le dépôt ne correspond pas à la base (fichier supprimé, mauvaise branche ?).',
      );
    }
    if (onDisk !== row.name) {
      throw new Error(
        `Migration ${row.version} renommée : appliquée sous le nom ${row.name}, présente sous le nom ` +
          `${onDisk}. Une migration appliquée ne se renomme jamais.`,
      );
    }
  }
}

/** Applique les migrations en attente et vérifie les checksums des migrations déjà appliquées. */
export async function runMigrations(options: MigrationsOptions): Promise<MigrationsResult> {
  const files = await listSqlFiles(options.directory);
  const sql = openSingleConnection(options.databaseUrl);
  const result: MigrationsResult = { applied: [], alreadyApplied: [] };
  try {
    await sql`select pg_advisory_lock(${MIGRATIONS_LOCK_KEY})`;
    try {
      await ensureMigrationsTable(sql);
      const rows = await sql<{ version: string; name: string; checksum: string }[]>`
        select version, name, checksum from schema_migrations order by version`;
      assertAppliedMatchDisk(rows, files);
      const appliedChecksums = new Map(rows.map((row) => [row.version, row.checksum]));

      for (const file of files) {
        const content = await readFile(file.path, 'utf8');
        const checksum = computeChecksum(content);
        const known = appliedChecksums.get(file.version);
        if (known !== undefined) {
          if (known !== checksum) {
            throw new Error(
              `Erreur de checksum : ${file.name}.sql a été modifié après son application. ` +
                'Une migration appliquée ne se modifie jamais : ajouter une nouvelle migration.',
            );
          }
          options.log(`${file.name} : déjà appliquée`);
          result.alreadyApplied.push(file.name);
          continue;
        }
        assertNoTransactionControl(file.name, content);
        await sql.begin(async (tx) => {
          await tx.unsafe(content);
          await tx`
            insert into schema_migrations (version, name, checksum)
            values (${file.version}, ${file.name}, ${checksum})`;
        });
        options.log(`${file.name} : appliquée`);
        result.applied.push(file.name);
      }
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATIONS_LOCK_KEY})`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return result;
}

/** Noms des migrations présentes sur disque mais pas encore enregistrées dans `schema_migrations`. */
export async function findPendingMigrations(
  sql: Sql,
  migrationsDirectory: string,
): Promise<string[]> {
  const files = await listSqlFiles(migrationsDirectory);
  const tables = await sql<{ present: boolean }[]>`
    select to_regclass('public.schema_migrations') is not null as present`;
  let applied = new Set<string>();
  if (tables[0]?.present) {
    const rows = await sql<{ version: string }[]>`select version from schema_migrations`;
    applied = new Set(rows.map((row) => row.version));
  }
  return files.filter((file) => !applied.has(file.version)).map((file) => file.name);
}
