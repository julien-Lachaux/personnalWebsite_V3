import { createServer, type Server, type Socket } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { DrizzleDatabaseClient } from './drizzle-database-client.js';

describe('DrizzleDatabaseClient.ping', () => {
  let server: Server | undefined;
  const sockets: Socket[] = [];

  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      socket.destroy();
    }
    const listening = server;
    server = undefined;
    if (listening !== undefined) {
      await new Promise<void>((resolve) => {
        listening.close(() => {
          resolve();
        });
      });
    }
  });

  /** Serveur TCP qui accepte les connexions et ne répond jamais : une base figée. */
  async function frozenDatabaseUrl(): Promise<string> {
    const listening = createServer((socket) => {
      sockets.push(socket);
    });
    server = listening;
    await new Promise<void>((resolve) => {
      listening.listen(0, '127.0.0.1', resolve);
    });
    const address = listening.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return `postgres://u:p@127.0.0.1:${String(port)}/db`;
  }

  it('renvoie false dans le délai imparti quand la base est figée (au lieu de bloquer)', async () => {
    const client = new DrizzleDatabaseClient(await frozenDatabaseUrl(), { pingTimeoutMs: 300 });

    const start = Date.now();
    const up = await client.ping();

    expect(up).toBe(false);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('renvoie false quand la base refuse la connexion', async () => {
    const client = new DrizzleDatabaseClient('postgres://u:p@127.0.0.1:1/db', {
      pingTimeoutMs: 1000,
    });

    expect(await client.ping()).toBe(false);
  });
});
