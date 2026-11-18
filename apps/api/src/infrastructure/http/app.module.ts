import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../db/database.module.js';
import { DocsModule } from './docs/docs.module.js';
import { HealthModule } from './health/health.module.js';

/**
 * Module racine. Fichier PARTAGÉ : au lot 3, les agents API n'y touchent pas, chaque module
 * de ressource est déjà enregistré ci-dessous (voir CLAUDE.md, règle « modules isolés »).
 */
@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, DocsModule],
})
export class AppModule {}
