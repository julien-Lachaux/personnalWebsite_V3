import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type Sql } from 'postgres';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';

/**
 * Une base qui ne répond pas (ici : une table verrouillée par une autre transaction) ne doit pas
 * bloquer les requêtes indéfiniment : le délai SQL ou le délai HTTP les interrompt.
 */
describe('délais face à une base bloquée', () => {
  let locker: Sql | undefined;
  let release: (() => void) | undefined;
  let app: NestFastifyApplication | undefined;
  const previous: Record<string, string | undefined> = {};

  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterEach(async () => {
    release?.();
    await locker?.end({ timeout: 5 });
    await app?.close();
    locker = undefined;
    release = undefined;
    app = undefined;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  /** Pose le verrou exclusif sur `profile` dans une transaction laissée ouverte. */
  async function lockProfileTable(): Promise<void> {
    const connection = openTestSql();
    locker = connection;
    const ready = new Promise<void>((resolve) => {
      void connection
        .begin(async (tx) => {
          await tx`lock table profile in access exclusive mode`;
          resolve();
          await new Promise<void>((done) => {
            release = done;
          });
        })
        .catch(() => undefined);
    });
    await ready;
  }

  async function startWith(values: Record<string, string>): Promise<NestFastifyApplication> {
    for (const key of Object.keys(values)) {
      previous[key] = process.env[key];
    }
    Object.assign(process.env, values, { RATE_LIMIT_MAX: '100000' });
    previous['RATE_LIMIT_MAX'] = undefined;
    app = await startTestApp();
    return app;
  }

  it('le délai HTTP répond 503 problem+json au lieu de laisser la requête pendre', async () => {
    const server = await startWith({ HANDLER_TIMEOUT_MS: '500', DB_STATEMENT_TIMEOUT_MS: '60000' });
    await lockProfileTable();

    const start = Date.now();
    const response = await server.inject({ method: 'GET', url: '/api/v1/profile' });

    expectProblem(response, 503);
    expect(Date.now() - start).toBeLessThan(5000);
    // Le reste de l'API répond pendant que cette requête est bloquée.
    expect((await server.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
  });

  it('le délai SQL interrompt la requête bloquée : 500 générique, sans détail technique', async () => {
    const server = await startWith({ HANDLER_TIMEOUT_MS: '60000', DB_STATEMENT_TIMEOUT_MS: '500' });
    await lockProfileTable();

    const start = Date.now();
    const response = await server.inject({ method: 'GET', url: '/api/v1/profile' });

    const problem = expectProblem(response, 500);
    expect(JSON.stringify(problem)).not.toContain('statement timeout');
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
