import { type TestProject } from 'vitest/node';

import { resetDatabase } from '../../src/infrastructure/db/reset-database.js';
import {
  baseDatabaseName,
  migrationsDirectory,
  modelDatabaseName,
  openAdminSql,
  quoteIdentifier,
  recreateFromModel,
  seedsDirectory,
  urlForDatabase,
  workerDatabaseName,
} from './database.js';

/**
 * Prépare les bases de test une fois par run, avant le premier fichier e2e :
 * 1. le modèle `<base>_model` : schéma vidé, migrations puis seeds (même séquence que `db:reset`).
 *    Il est reconstruit à CHAQUE run, jamais réutilisé d'un run à l'autre : une migration ou un seed
 *    modifié ne peut pas le laisser périmé ;
 * 2. la base de chaque processus Vitest (`<base>_w1` à `<base>_wN`), copie du modèle. Un fichier qui
 *    ne recrée pas la base (health, docs) la trouve donc migrée et seedée, comme avant.
 * `resetTestDatabase()` recopie ensuite le modèle au lieu de tout rejouer (voir `database.ts`).
 */
export default async function setup(project: TestProject): Promise<void> {
  const databaseUrl = project.config.env['DATABASE_URL'];
  if (typeof databaseUrl !== 'string' || databaseUrl === '') {
    throw new Error('DATABASE_URL absent de la configuration du projet e2e (vitest.config.ts).');
  }
  const base = baseDatabaseName(databaseUrl);
  const model = modelDatabaseName(base);
  const admin = openAdminSql(databaseUrl);
  try {
    await admin.unsafe(`drop database if exists ${quoteIdentifier(model)} with (force)`);
    await admin.unsafe(`create database ${quoteIdentifier(model)}`);
    await resetDatabase({
      databaseUrl: urlForDatabase(databaseUrl, model),
      migrationsDirectory,
      seedsDirectory,
      log: () => undefined,
    });

    // Une base par processus : `maxWorkers` vaut 1 quand `fileParallelism` est à false (Vitest).
    for (let id = 1; id <= project.config.maxWorkers; id += 1) {
      await recreateFromModel(admin, base, workerDatabaseName(base, String(id)));
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}
