import { fileURLToPath } from 'node:url';

import postgres, { type Sql } from 'postgres';

/** Racine du dépôt, depuis `apps/api/test/support/`. */
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const migrationsDirectory = `${repositoryRoot}db/migrations`;
export const seedsDirectory = `${repositoryRoot}db/seeds`;

/**
 * Bases de test : une instance PostgreSQL, plusieurs bases.
 * - `<base>_model` : modèle migré et seedé, construit une fois par run par le `globalSetup` ;
 * - `<base>_w<n>` : base du processus Vitest `n` (`VITEST_POOL_ID`), copie du modèle ;
 * où `<base>` est le nom de la base de `DATABASE_URL` (`siteperso_test`). Un processus ne touche que
 * sa base : les fichiers e2e peuvent tourner en parallèle, un processus par fichier.
 */
const WORKER_SUFFIX = /_w\d+$/;

/** Numéro du processus Vitest ; 1 hors d'un worker (la base du premier processus). */
export function workerId(): string {
  return process.env['VITEST_POOL_ID'] ?? '1';
}

/** Nom de la base d'une URL PostgreSQL, sans le suffixe `_w<n>` d'une URL déjà dérivée. */
export function baseDatabaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1)).replace(WORKER_SUFFIX, '');
}

export const modelDatabaseName = (base: string): string => `${base}_model`;
export const workerDatabaseName = (base: string, id: string): string => `${base}_w${id}`;

/** Même serveur, mêmes identifiants, autre base. */
export function urlForDatabase(url: string, database: string): string {
  const derived = new URL(url);
  derived.pathname = `/${encodeURIComponent(database)}`;
  return derived.toString();
}

/** Identifiant SQL entre guillemets : les noms viennent du code de test, jamais d'une entrée externe. */
export const quoteIdentifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** URL de base de `DATABASE_URL` (posé par le projet e2e de `vitest.config.ts`). */
function configuredUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL absent : les e2e se lancent par le projet e2e de vitest.config.ts.',
    );
  }
  return url;
}

/** URL de la base de CE processus, dérivée de `DATABASE_URL`. */
export function testDatabaseUrl(): string {
  const url = configuredUrl();
  return urlForDatabase(url, workerDatabaseName(baseDatabaseName(url), workerId()));
}

/**
 * Dirige l'application testée vers la base de ce processus : `createApp` lit `DATABASE_URL` dans
 * l'environnement. Idempotent (le suffixe `_w<n>` d'une URL déjà dérivée est remplacé, pas ajouté).
 * À appeler avant `createApp` ou la compilation du module de test Nest.
 */
export function useWorkerDatabase(): void {
  process.env['DATABASE_URL'] = testDatabaseUrl();
}

/** Connexion d'administration (base de maintenance `postgres`) : créer et supprimer des bases. */
export function openAdminSql(url: string = configuredUrl()): Sql {
  return postgres(urlForDatabase(url, 'postgres'), { max: 1, onnotice: () => undefined });
}

/**
 * Remplace la base `database` par une copie du modèle de `base`. `with (force)` coupe les
 * connexions encore ouvertes (pool de l'application testée, `openTestSql()`) : postgres.js les
 * rouvre à la requête suivante. Le serveur ne rend la main qu'une fois ces sessions parties.
 */
export async function recreateFromModel(admin: Sql, base: string, database: string): Promise<void> {
  await admin.unsafe(`drop database if exists ${quoteIdentifier(database)} with (force)`);
  await admin.unsafe(
    `create database ${quoteIdentifier(database)} template ${quoteIdentifier(modelDatabaseName(base))}`,
  );
}

/**
 * Remet la base de test de ce processus dans l'état de `db:reset` : schéma vidé, migrations et
 * seeds. Ils ne sont pas rejoués : la base est recopiée du modèle que le `globalSetup` a construit
 * avec les mêmes fichiers et la même séquence (preuve : `db/template-database.e2e-spec.ts`).
 */
export async function resetTestDatabase(): Promise<void> {
  const url = testDatabaseUrl();
  const base = baseDatabaseName(url);
  const admin = openAdminSql(url);
  try {
    await recreateFromModel(admin, base, workerDatabaseName(base, workerId()));
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/** Connexion `postgres` brute sur la base de test, pour les fixtures. À fermer avec `end()`. */
export function openTestSql(): Sql {
  return postgres(testDatabaseUrl(), { max: 2, onnotice: () => undefined });
}
