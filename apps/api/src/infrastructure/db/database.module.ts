import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';

import { DATABASE_CLIENT } from '../../application/ports/database-client.port.js';
import { APP_CONFIG } from '../config/config.module.js';
import { type Env } from '../config/env.schema.js';
import { DrizzleDatabaseClient } from './drizzle-database-client.js';

/**
 * Fournit la connexion Drizzle à toute l'application :
 * - `DATABASE_CLIENT` : le port, pour la couche application ;
 * - `DrizzleDatabaseClient` : l'implémentation, pour les dépôts d'`infrastructure/db`.
 */
@Global()
@Module({
  providers: [
    {
      provide: DrizzleDatabaseClient,
      useFactory: (env: Env) => new DrizzleDatabaseClient(env.DATABASE_URL),
      inject: [APP_CONFIG],
    },
    { provide: DATABASE_CLIENT, useExisting: DrizzleDatabaseClient },
  ],
  exports: [DrizzleDatabaseClient, DATABASE_CLIENT],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DrizzleDatabaseClient) private readonly client: DrizzleDatabaseClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
