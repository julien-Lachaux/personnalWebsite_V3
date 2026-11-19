// Configuration Nuxt 4 du front (docs/05, D1 et D2) : génération statique (`nuxt generate`) des
// pages FR (sans préfixe) et EN (`/en/...`) ; aucun serveur Node du front en production.
// Fichier partagé : réservé au lead-architecte (règle « modules isolés » du front, CLAUDE.md).
const strictCompilerOptions = {
  // Mêmes exigences que tsconfig.base.json du back, en plus du `strict` de Nuxt.
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true,
  noPropertyAccessFromIndexSignature: true,
  useUnknownInCatchVariables: true,
};

export default defineNuxtConfig({
  compatibilityDate: '2026-11-19',
  modules: ['@nuxtjs/i18n'],
  // Aucune collecte (D8) et aucun appel réseau implicite au build.
  telemetry: false,
  devtools: { enabled: false },
  // L'API de dev écoute sur 3000 et autorise l'origine http://localhost:3001 (CORS_ORIGIN).
  devServer: { port: 3001 },

  // Valeurs publiques lues au moment de `nuxt generate` (variables NUXT_PUBLIC_*), jamais commitées :
  // modèle dans apps/web/.env.example. Aucune vraie adresse dans le dépôt.
  runtimeConfig: {
    public: {
      contactEmail: '',
    },
  },

  i18n: {
    // FR par défaut sans préfixe, EN sous /en (docs/02, F0-05).
    strategy: 'prefix_except_default',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
    ],
    // Pas de redirection selon la langue du navigateur : un site statique sert l'URL demandée.
    detectBrowserLanguage: false,
    // URL absolue des liens hreflang et canonical : NUXT_PUBLIC_I18N_BASE_URL au build.
    baseUrl: 'http://localhost:3001',
  },

  nitro: {
    prerender: {
      routes: ['/', '/en'],
      crawlLinks: true,
      failOnError: true,
    },
  },

  typescript: {
    strict: true,
    tsConfig: { compilerOptions: strictCompilerOptions },
    sharedTsConfig: { compilerOptions: strictCompilerOptions },
    // Projet « node » : configuration de Nuxt et outillage de test hors `app/` (Vitest, Playwright
    // et ses parcours `test/**/*.e2e.ts`), vérifiés par `pnpm typecheck` comme le reste.
    nodeTsConfig: {
      compilerOptions: { ...strictCompilerOptions, types: ['node'] },
      include: ['../vitest.config.ts', '../playwright.config.ts', '../test/**/*.ts'],
    },
  },
});
