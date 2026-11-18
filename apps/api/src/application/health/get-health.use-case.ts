import { type HealthResponse } from '@siteperso/contracts';

import { type DatabaseClientPort } from '../ports/database-client.port.js';

/** Cas d'usage : état de l'API et de ses dépendances. Classe pure, sans décorateur Nest. */
export class GetHealthUseCase {
  constructor(private readonly database: DatabaseClientPort) {}

  async execute(): Promise<HealthResponse> {
    const databaseUp = await this.database.ping();
    return {
      status: 'ok',
      checks: { database: databaseUp ? 'up' : 'down' },
    };
  }
}
