import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { type LoggerService, type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { loadEnv } from '../config/env.js';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './problem/problem-details.filter.js';

export const GLOBAL_PREFIX = 'api/v1';

export interface CreateAppOptions {
  /** Logger Nest ; `false` pour couper les logs (tests). */
  logger?: LoggerService | LogLevel[] | false;
}

/**
 * Construit l'application Nest/Fastify sans l'écouter : utilisée par `main.ts` (listen)
 * et par les tests e2e (`app.inject`). Toute la configuration transverse est ici.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  // La configuration est validée avant de construire Fastify : `trustProxy` se fixe à la création.
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: env.TRUST_PROXY }),
    { logger: options.logger ?? ['error', 'warn', 'log'] },
  );

  // En-têtes de sécurité (CSP inutile sur une API JSON, le reste reste actif).
  await app.register(helmet, { contentSecurityPolicy: false });

  // Rate limiting global léger par IP (en-têtes x-ratelimit-*, 429 problem+json via le filtre).
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  // CORS restreint au(x) domaine(s) du front, lecture seule.
  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 600,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  return app;
}
