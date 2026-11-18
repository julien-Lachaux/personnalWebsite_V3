import { Module } from '@nestjs/common';

import { GetHealthUseCase } from '../../../application/health/get-health.use-case.js';
import {
  DATABASE_CLIENT,
  type DatabaseClientPort,
} from '../../../application/ports/database-client.port.js';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: GetHealthUseCase,
      useFactory: (database: DatabaseClientPort) => new GetHealthUseCase(database),
      inject: [DATABASE_CLIENT],
    },
  ],
})
export class HealthModule {}
