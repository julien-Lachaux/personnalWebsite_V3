import 'reflect-metadata';

import { type NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from '../../src/infrastructure/http/create-app.js';
import { useWorkerDatabase } from './database.js';

/**
 * Démarre l'application complète sans écouter de port : les requêtes passent par
 * `app.inject()` (light-my-request). La configuration vient du projet e2e de `vitest.config.ts`,
 * sauf la base : celle du processus Vitest (voir `database.ts`).
 */
export async function startTestApp(): Promise<NestFastifyApplication> {
  useWorkerDatabase();
  const app = await createApp({ logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** Origine autorisée par CORS dans la configuration de test. */
export const ALLOWED_ORIGIN = process.env['CORS_ORIGIN']?.split(',')[0]?.trim() ?? '';
