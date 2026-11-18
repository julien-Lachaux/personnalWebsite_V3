import { readFile } from 'node:fs/promises';

import {
  findPendingMigrations,
  listSqlFiles,
  type LogFn,
  openSingleConnection,
} from './migrations-runner.js';
import { convergeToSeeds } from './seeds-convergence.js';
import { splitSqlStatements, statementVerb } from './sql-statements.js';

/** Verbes d'écriture : une instruction de seed qui n'en touche aucune ligne est suspecte. */
const WRITE_VERBS = new Set(['insert', 'update', 'delete']);

export interface SeedsOptions {
  databaseUrl: string;
  /** Répertoire des seeds (`db/seeds`). */
  directory: string;
  /** Répertoire des migrations, pour refuser un seed tant qu'une migration est en attente. */
  migrationsDirectory: string;
  log: LogFn;
}

/** Extrait court d'une instruction, pour un message d'erreur. */
function excerpt(statement: string): string {
  const oneLine = statement.replace(/\s+/g, ' ');
  return oneLine.length > 200 ? `${oneLine.slice(0, 200)}…` : oneLine;
}

/**
 * Exécute tous les seeds, dans l'ordre, dans UNE transaction (tout ou rien), instruction par
 * instruction, puis fait converger la base vers leur contenu (`convergeToSeeds`).
 *
 * Les seeds sont des `insert … on conflict do update` rejouables à chaque déploiement, sans table
 * de suivi. Une instruction d'écriture qui ne touche aucune ligne est une erreur : c'est la
 * signature d'un slug inconnu (une jointure interne vide ignore silencieusement la ligne).
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
    const messages: string[] = [];
    await sql.begin(async (tx) => {
      for (const file of files) {
        const content = await readFile(file.path, 'utf8');
        for (const statement of splitSqlStatements(content)) {
          const result = await tx.unsafe(statement);
          if (WRITE_VERBS.has(statementVerb(statement)) && result.count === 0) {
            throw new Error(
              `${file.name} : une instruction n'a touché aucune ligne (slug inconnu ?) : ` +
                excerpt(statement),
            );
          }
        }
        messages.push(`${file.name} : exécuté`);
        executed.push(file.name);
      }
      await convergeToSeeds(tx, (line) => messages.push(line));
    });
    for (const message of messages) {
      options.log(message);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return executed;
}
