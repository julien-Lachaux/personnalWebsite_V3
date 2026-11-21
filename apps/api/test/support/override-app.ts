import 'reflect-metadata';

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/infrastructure/http/app.module.js';
import { GLOBAL_PREFIX } from '../../src/infrastructure/http/create-app.js';
import { ProblemDetailsFilter } from '../../src/infrastructure/http/problem/problem-details.filter.js';
import { useWorkerDatabase } from './database.js';

/**
 * Application montée comme `createApp` (même préfixe global, même filtre problem+json) mais sur
 * un module de test dont on remplace des fournisseurs (`overrideProvider(token).useValue(...)`).
 * Helmet, CORS et rate limiting ne sont pas enregistrés : ils ne servent pas à ces tests.
 */
export async function appWithOverrides(
  overrides: readonly (readonly [symbol, unknown])[],
): Promise<NestFastifyApplication> {
  useWorkerDatabase();
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [token, value] of overrides) {
    builder = builder.overrideProvider(token).useValue(value);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
