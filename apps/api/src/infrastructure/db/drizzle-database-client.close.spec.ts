import { type Sql } from 'postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DrizzleDatabaseClient } from './drizzle-database-client.js';

describe('DrizzleDatabaseClient.close', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ferme le pool et attend sa fermeture, au plus 5 secondes (l’arrêt ne reste pas bloqué)', async () => {
    const client = new DrizzleDatabaseClient('postgres://u:p@127.0.0.1:1/db');
    let ended = false;
    const end = vi
      .spyOn((client as unknown as { sql: Sql }).sql, 'end')
      .mockImplementation(async () => {
        await Promise.resolve();
        ended = true;
      });

    await client.close();

    expect(end).toHaveBeenCalledExactlyOnceWith({ timeout: 5 });
    expect(ended).toBe(true);
  });
});
