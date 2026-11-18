/** Jeton d'injection du port de connexion à la base de données. */
export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

/**
 * Port (côté application) vers la base de données. L'application ne connaît ni Drizzle ni
 * PostgreSQL : seule `infrastructure/db` implémente ce port. Les dépôts par ressource (lot 3)
 * définissent leurs propres ports dans `application/<resource>/ports/`.
 */
export interface DatabaseClientPort {
  /** Vérifie que la base répond (`select 1`). Ne lève jamais : renvoie `false` en cas d'échec. */
  ping(): Promise<boolean>;
}
