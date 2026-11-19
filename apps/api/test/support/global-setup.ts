import { type TestProject } from 'vitest/node';

import { resetDatabase } from '../../src/infrastructure/db/reset-database.js';
import { migrationsDirectory, seedsDirectory } from './database.js';

/**
 * Prépare la base de test une fois avant tous les fichiers e2e : schéma vidé, migrations, seeds.
 * Sans cette étape, un fichier qui ne recrée pas la base dépend de celui qui l'a précédé et la
 * première exécution sur une base neuve échoue (relation "resources" does not exist).
 */
export default async function setup(project: TestProject): Promise<void> {
  const databaseUrl = project.config.env['DATABASE_URL'];
  if (typeof databaseUrl !== 'string' || databaseUrl === '') {
    throw new Error('DATABASE_URL absent de la configuration du projet e2e (vitest.config.ts).');
  }
  await resetDatabase({
    databaseUrl,
    migrationsDirectory,
    seedsDirectory,
    log: () => undefined,
  });
}
