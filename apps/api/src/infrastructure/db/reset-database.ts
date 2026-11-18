import { type LogFn, openSingleConnection, runMigrations } from './migrations-runner.js';
import { runSeeds } from './seeds-runner.js';

export interface ResetOptions {
  databaseUrl: string;
  migrationsDirectory: string;
  seedsDirectory: string;
  log: LogFn;
}

/**
 * Recrée le schéma `public` (tout est supprimé), puis rejoue les migrations et les seeds.
 * Refusé en production : la commande détruit toutes les données.
 */
export async function resetDatabase(options: ResetOptions): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'db:reset est refusé en production (NODE_ENV=production) : il détruit toutes les données.',
    );
  }
  const sql = openSingleConnection(options.databaseUrl);
  try {
    await sql.unsafe('drop schema public cascade; create schema public');
    options.log('schéma public recréé');
  } finally {
    await sql.end({ timeout: 5 });
  }
  await runMigrations({
    databaseUrl: options.databaseUrl,
    directory: options.migrationsDirectory,
    log: options.log,
  });
  await runSeeds({
    databaseUrl: options.databaseUrl,
    directory: options.seedsDirectory,
    migrationsDirectory: options.migrationsDirectory,
    log: options.log,
  });
}
