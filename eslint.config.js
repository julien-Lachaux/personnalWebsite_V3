// Configuration ESLint partagée par tout le monorepo (flat config).
// Chaque paquet lance `eslint .` depuis son dossier : ESLint remonte jusqu'à ce fichier.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      // Test par mutation : rapports et sandboxes de Stryker (copies mutées du code).
      '**/reports/mutation/**',
      '**/.stryker-tmp*/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Les ports hexagonaux sont des interfaces : on autorise les interfaces vides de transition.
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      // `import type` explicite : évite d'embarquer des types dans le JS émis (et SWC l'exige).
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Les promesses doivent être attendues ou explicitement ignorées avec `void`.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      // Autorise les identifiants préfixés `_` pour les paramètres volontairement inutilisés.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Dans une appli Nest, les classes de modules sont volontairement vides.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    // Les fichiers de configuration JS/TS à la racine ne font pas partie d'un projet TS.
    files: ['**/*.js', '**/*.mjs', '**/*.config.ts', '**/vitest*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
