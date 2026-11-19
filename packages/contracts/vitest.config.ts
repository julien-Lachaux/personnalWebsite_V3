// Tests unitaires des contrats. Couverture : 100 % exigé sur les quatre métriques, aucun fichier
// de production exclu, aucun commentaire d'ignore (seuls les tests et leurs fixtures sont écartés).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.fixtures.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
