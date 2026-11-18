import { fileURLToPath } from 'node:url';

import { loadEnv } from '../infrastructure/config/env.js';

/** Racine du dépôt, depuis `apps/api/{src,dist}/cli/`. */
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const migrationsDirectory = `${repositoryRoot}db/migrations`;
export const seedsDirectory = `${repositoryRoot}db/seeds`;

/** Écrit une ligne de journal sur la sortie standard. */
export function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** URL de la base lue dans l'environnement validé. */
export function databaseUrl(): string {
  return loadEnv().DATABASE_URL;
}

/** Exécute une commande CLI : affiche l'erreur (sans pile) et sort en code 1. */
export async function runCli(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    process.stderr.write(`Erreur : ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
