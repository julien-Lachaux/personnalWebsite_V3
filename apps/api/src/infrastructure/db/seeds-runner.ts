import { readFile } from 'node:fs/promises';

import {
  findPendingMigrations,
  listSqlFiles,
  type LogFn,
  openSingleConnection,
} from './migrations-runner.js';

export interface SeedsOptions {
  databaseUrl: string;
  /** Répertoire des seeds (`db/seeds`). */
  directory: string;
  /** Répertoire des migrations, pour refuser un seed tant qu'une migration est en attente. */
  migrationsDirectory: string;
  log: LogFn;
}

/**
 * Exécute chaque seed, dans l'ordre, chacun dans sa transaction. Les seeds sont idempotents
 * (`on conflict … do update`) : ils sont rejoués à chaque appel, sans table de suivi.
 */
export async function runSeeds(options: SeedsOptions): Promise<string[]> {
  const files = await listSqlFiles(options.directory);
  const sql = openSingleConnection(options.databaseUrl);
  const executed: string[] = [];
  try {
    const pending = await findPendingMigrations(sql, options.migrationsDirectory);
    if (pending.length > 0) {
      throw new Error(
        `Migrations en attente (${pending.join(', ')}) : lancer « pnpm db:migrate » avant les seeds.`,
      );
    }
    for (const file of files) {
      const content = await readFile(file.path, 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
      });
      options.log(`${file.name} : exécuté`);
      executed.push(file.name);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return executed;
}
