// Tests unitaires : aucun accès réseau ni base de données.
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // SWC émet les métadonnées de décorateurs (design:paramtypes) dont l'injection Nest dépend ;
    // esbuild (transformateur par défaut de Vitest) ne le fait pas.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        // Hors périmètre du seuil (backlog L4-07) : schéma Drizzle déclaratif, points d'entrée.
        'src/infrastructure/db/schema/**',
        'src/cli/**',
        'src/main.ts',
        // Exercés uniquement par les e2e contre PostgreSQL (aucun accès base en test unitaire) :
        // dépôts Drizzle, client de base, runners SQL, câblage Nest et assemblage de l'application.
        'src/infrastructure/db/**/drizzle-*.ts',
        'src/infrastructure/db/database.module.ts',
        'src/infrastructure/db/reset-database.ts',
        'src/infrastructure/db/seeds-runner.ts',
        'src/infrastructure/config/config.module.ts',
        // Interfaces et jetons d'injection : aucune logique.
        'src/application/**/ports/**',
        'src/infrastructure/http/**/*.module.ts',
        'src/infrastructure/http/create-app.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 85, branches: 75 },
    },
  },
});
