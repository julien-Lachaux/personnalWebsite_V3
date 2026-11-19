import { createServer, type Server, type Socket } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DrizzleDatabaseClient } from './drizzle-database-client.js';

/**
 * Faux serveur PostgreSQL minimal : il lit ce que le client envoie (message de démarrage, puis
 * requête), accepte l'authentification (`AuthenticationOk` + `ReadyForQuery`) et ne répond jamais
 * à la requête. Il rend observables les paramètres de connexion et le SQL réellement émis.
 */
describe('DrizzleDatabaseClient : ce que le client envoie au serveur', () => {
  let server: Server | undefined;
  const sockets: Socket[] = [];
  const clients: DrizzleDatabaseClient[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const socket of sockets.splice(0)) {
      socket.destroy();
    }
    for (const client of clients.splice(0)) {
      await client.close();
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

  async function fakeDatabase(): Promise<{ url: string; received: () => string }> {
    const chunks: Buffer[] = [];
    const listening = createServer((socket) => {
      sockets.push(socket);
      let authenticated = false;
      socket.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        if (!authenticated) {
          authenticated = true;
          // AuthenticationOk (R, longueur 8, code 0) puis ReadyForQuery (Z, longueur 5, « I »).
          socket.write(Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0, 0x5a, 0, 0, 0, 5, 0x49]));
        }
      });
    });
    server = listening;
    await new Promise<void>((resolve) => {
      listening.listen(0, '127.0.0.1', resolve);
    });
    const address = listening.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return {
      url: `postgres://u:p@127.0.0.1:${String(port)}/db`,
      // Les octets de contrôle (longueurs, séparateurs NUL) deviennent des espaces : on cherche du texte.
      received: () =>
        Buffer.concat(chunks)
          .toString('latin1')
          .replace(/\p{Cc}/gu, ' '),
    };
  }

  function track(client: DrizzleDatabaseClient): DrizzleDatabaseClient {
    clients.push(client);
    return client;
  }

  it('annonce statement_timeout à la connexion : 5 s par défaut', async () => {
    const database = await fakeDatabase();
    const client = track(new DrizzleDatabaseClient(database.url, { pingTimeoutMs: 400 }));

    await client.ping();

    expect(database.received()).toMatch(/statement_timeout\s+5000\s/);
  });

  it('annonce le statement_timeout configuré', async () => {
    const database = await fakeDatabase();
    const client = track(
      new DrizzleDatabaseClient(database.url, { statementTimeoutMs: 1234, pingTimeoutMs: 400 }),
    );

    await client.ping();

    expect(database.received()).toMatch(/statement_timeout\s+1234\s/);
  });

  it('émet « select 1 » pour le ping de santé', async () => {
    const database = await fakeDatabase();
    const client = track(new DrizzleDatabaseClient(database.url, { pingTimeoutMs: 400 }));

    expect(await client.ping()).toBe(false);

    expect(database.received()).toContain('select 1');
  });

  it('libère la minuterie du ping une fois la réponse connue', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const client = track(
      new DrizzleDatabaseClient('postgres://u:p@127.0.0.1:1/db', { pingTimeoutMs: 54_321 }),
    );

    expect(await client.ping()).toBe(false);

    const pingCall = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 54_321);
    expect(pingCall).toBeGreaterThanOrEqual(0);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[pingCall]?.value);
  });
});

describe('DrizzleDatabaseClient.db', () => {
  it('branche le schéma Drizzle : les tables sont accessibles par db.query', () => {
    const client = new DrizzleDatabaseClient('postgres://u:p@127.0.0.1:1/db');

    expect(Object.keys(client.db.query)).toEqual(
      expect.arrayContaining(['profile', 'profileTranslations', 'skills', 'experiences']),
    );
  });
});
