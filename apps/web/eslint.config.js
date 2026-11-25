// ESLint du front : la configuration racine (TypeScript typé, Prettier) plus les règles Vue.
// ESLint 10 prend le fichier de configuration le plus proche du fichier analysé : celui-ci pour
// apps/web, la racine pour le reste du monorepo.
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';

import root from '../../eslint.config.js';

export default tseslint.config(
  {
    // Sorties de Nuxt et de Playwright, handoff de design versionné (référence, pas du code).
    ignores: ['.nuxt/**', '.output/**', 'test-results/**', 'playwright-report/**', 'design/**'],
  },
  ...root,
  ...pluginVue.configs['flat/recommended'],
  // Accessibilité statique des gabarits (D4, SPEC § 10.2) : alternatives, noms accessibles,
  // interactions au clavier, aucun clic sur un élément non interactif…
  ...pluginVueA11y.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Les auto-imports de Nuxt (`computed`, `useI18n`…) ne sont pas des globales inconnues : vue-tsc
    // (`pnpm typecheck`) vérifie qu'ils existent.
    rules: { 'no-undef': 'off' },
  },
  {
    // Les noms des pages, des gabarits et de la racine viennent du routage de Nuxt (index, error).
    files: ['app/pages/**/*.vue', 'app/layouts/**/*.vue', 'app/app.vue', 'app/error.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    rules: {
      // Aucun HTML brut injecté (SPEC § 11, docs/05) : ni v-html, ni innerHTML via v-text/v-html
      // sur un composant.
      'vue/no-v-html': 'error',
      'vue/no-v-text-v-html-on-component': 'error',
    },
  },
  prettier,
);
