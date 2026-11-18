// Tests de bout en bout : application Nest complète (app.inject de Fastify) contre le
// PostgreSQL de test de docker-compose (`pnpm db:test:up`).
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.e2e-spec.ts'],
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
        'postgres://siteperso:siteperso@localhost:5433/siteperso_test',
    },
  },
});
