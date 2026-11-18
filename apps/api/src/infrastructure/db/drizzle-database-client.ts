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
export class DrizzleDatabaseClient implements DatabaseClientPort {
  private readonly sql: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, {
      max: 10,
      // Les NOTICE PostgreSQL (ex. « relation already exists ») n'ont rien à faire dans les logs.
      onnotice: () => undefined,
    });
    this.db = drizzle(this.sql, { schema });
  }

  async ping(): Promise<boolean> {
    try {
      await this.sql`select 1`;
      return true;
    } catch {
      return false;
    }
  }

  /** Ferme proprement le pool de connexions (appelé à l'arrêt de l'application). */
  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
