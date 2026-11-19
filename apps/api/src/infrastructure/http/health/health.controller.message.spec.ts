import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { type GetHealthUseCase } from '../../../application/health/get-health.use-case.js';
import { HealthController } from './health.controller.js';

describe('HealthController : base injoignable', () => {
  it('explique la panne dans le détail du 503', async () => {
    const down = { status: 'ok', checks: { database: 'down' } };
    const controller = new HealthController({
      execute: () => Promise.resolve(down),
    } as unknown as GetHealthUseCase);

    const error: unknown = await controller.get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).message).toBe(
      'La base de données est injoignable.',
    );
  });
});
