import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { type HealthResponse } from '@siteperso/contracts';

import { GetHealthUseCase } from '../../../application/health/get-health.use-case.js';

@Controller('health')
export class HealthController {
  constructor(private readonly getHealth: GetHealthUseCase) {}

  @Get()
  async get(): Promise<HealthResponse> {
    const health = await this.getHealth.execute();
    if (health.checks.database === 'down') {
      throw new ServiceUnavailableException('La base de données est injoignable.');
    }
    return health;
  }
}
