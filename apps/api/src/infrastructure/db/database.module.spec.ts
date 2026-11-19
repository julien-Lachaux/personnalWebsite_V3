import { describe, expect, it, vi } from 'vitest';

import { DatabaseModule } from './database.module.js';
import { type DrizzleDatabaseClient } from './drizzle-database-client.js';

describe('DatabaseModule', () => {
  it('ferme le pool de connexions à l’arrêt de l’application, et attend sa fermeture', async () => {
    let closed = false;
    const close = vi.fn(async () => {
      await Promise.resolve();
      closed = true;
    });

    await new DatabaseModule({ close } as unknown as DrizzleDatabaseClient).onModuleDestroy();

    expect(close).toHaveBeenCalledTimes(1);
    expect(closed).toBe(true);
  });
});
