import { describe, expect, it } from 'vitest';

import { type DatabaseClientPort } from '../ports/database-client.port.js';
import { GetHealthUseCase } from './get-health.use-case.js';

const databaseWith = (up: boolean): DatabaseClientPort => ({ ping: () => Promise.resolve(up) });

describe('GetHealthUseCase', () => {
  it('signale la base comme joignable', async () => {
    await expect(new GetHealthUseCase(databaseWith(true)).execute()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('signale la base comme injoignable sans lever', async () => {
    await expect(new GetHealthUseCase(databaseWith(false)).execute()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'down' },
    });
  });
});
