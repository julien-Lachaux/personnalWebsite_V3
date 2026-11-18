// Tests de bout en bout : application Nest complète (app.inject de Fastify) contre le
// PostgreSQL de test de docker-compose (`pnpm db:test:up`).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Le `.env` racine (celui de docker compose) fixe POSTGRES_TEST_PORT pour les worktrees en
// parallèle ; les variables déjà présentes dans l'environnement gardent la priorité.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}
const testPort = process.env['POSTGRES_TEST_PORT'] ?? '5433';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    // Base neuve garantie avant le premier fichier (migrations + seeds).
    globalSetup: ['test/support/global-setup.ts'],
    environment: 'node',
    // Un seul processus : l'application et sa connexion sont partagées entre les fichiers.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      PORT: process.env['PORT'] ?? '3000',
      CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        `postgres://siteperso:siteperso@localhost:${testPort}/siteperso_test`,
    },
  },
});
