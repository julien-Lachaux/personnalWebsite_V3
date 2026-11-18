import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { type DatabaseClientPort } from '../../application/ports/database-client.port.js';
import * as schema from './schema/index.js';

/**
 * Implémentation Drizzle (driver `postgres`) du port de base de données.
 * La connexion est paresseuse : rien n'est ouvert avant la première requête.
 * Le schéma Drizzle (`schema/`, dérivé du SQL de `db/migrations`) est branché sur `db`, exposé
 * pour les dépôts de `infrastructure/db/<resource>/` (lot 3).
 */
export interface DrizzleDatabaseClientOptions {
  /** Durée maximale d'une requête SQL, en ms (`statement_timeout`). */
  statementTimeoutMs?: number;
  /** Durée maximale du ping de santé, en ms : au-delà, la base est déclarée injoignable. */
  pingTimeoutMs?: number;
}

/** Secondes d'attente d'une connexion TCP avant d'abandonner (base figée ou injoignable). */
const CONNECT_TIMEOUT_SECONDS = 5;
/** Secondes avant de fermer une connexion inactive du pool. */
const IDLE_TIMEOUT_SECONDS = 60;

export class DrizzleDatabaseClient implements DatabaseClientPort {
  private readonly sql: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  private readonly pingTimeoutMs: number;

  constructor(databaseUrl: string, options: DrizzleDatabaseClientOptions = {}) {
    this.pingTimeoutMs = options.pingTimeoutMs ?? 2000;
    this.sql = postgres(databaseUrl, {
      max: 10,
      // Sans ces délais, une base figée (pause, réseau coupé) bloque les requêtes indéfiniment.
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      idle_timeout: IDLE_TIMEOUT_SECONDS,
      connection: { statement_timeout: options.statementTimeoutMs ?? 5000 },
      // Les NOTICE PostgreSQL (ex. « relation already exists ») n'ont rien à faire dans les logs.
      onnotice: () => undefined,
    });
    this.db = drizzle(this.sql, { schema });
  }

  async ping(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => {
        resolve(false);
      }, this.pingTimeoutMs);
    });
    try {
      return await Promise.race([this.sql`select 1`.then(() => true as const), timeout]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ferme proprement le pool de connexions (appelé à l'arrêt de l'application). */
  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
