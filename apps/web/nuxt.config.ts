// Configuration Nuxt 4 du front (docs/05, D1 et D2) : génération statique (`nuxt generate`) des
// pages FR (sans préfixe) et EN (`/en/...`) ; aucun serveur Node du front en production.
// Fichier partagé : réservé au lead-architecte (règle « modules isolés » du front, CLAUDE.md).

import { themeScript } from './app/domain/theme-script';

// Libellés d'interface : un fichier commun et un fichier par section et par langue
// (i18n/locales/<langue>/<fichier>.json), pour que deux agents de section en parallèle n'écrivent
// jamais le même fichier (décision du 20 nov. 2026). Chaque fichier de section ne contient que
// l'espace de clés de sa section ; @nuxtjs/i18n les charge dans l'ordre et les fusionne.
const messageFiles = ['common', 'shell', 'profile', 'experience', 'recommendations', 'ai'];
const filesOf = (language: string): string[] =>
  messageFiles.map((name) => `${language}/${name}.json`);

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

  // Design system global (lot F1) : polices auto-hébergées (D6), tokens et thèmes du handoff, tokens
  // ajoutés par décision (bordure des contrôles, D12), base. L'ordre compte : les tokens définissent
  // les variables que la base utilise. Interface préférences → CSS : les attributs `data-*` de
  // <html>, décrits en tête de app/assets/css/tokens.css.
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/tokens.css',
    '~/assets/css/control-tokens.css',
    '~/assets/css/base.css',
  ],

  app: {
    head: {
      // Script de thème sans flash (D5) : en tête, avant les feuilles de style et tout module, il pose
      // les attributs de <html> (thème, réglages d'accessibilité) depuis le réglage enregistré et le
      // système, avant le premier affichage. Texte et empreinte CSP : app/domain/theme-script.ts.
      script: [{ key: 'theme', innerHTML: themeScript(), tagPriority: 'critical' }],
      // Seule la police du texte courant (Space Grotesk, sous-ensemble latin) est préchargée ; même
      // URL que son @font-face (fonts.css), `crossorigin` exigé pour une police. JetBrains Mono et
      // Atkinson Hyperlegible ne se téléchargent qu'à l'usage (F1-02).
      link: [
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/space-grotesk/space-grotesk-latin-wght-normal.woff2',
          crossorigin: '',
        },
      ],
    },
  },

  // Valeurs lues au moment de `nuxt generate`, jamais commitées : modèle dans apps/web/.env.example.
  // - privées (absentes de la charge utile envoyée au navigateur) : source du CV (`NUXT_CV_SOURCE`,
  //   `api` par défaut ou `fixtures`) et URL de base de l'API (`NUXT_API_BASE_URL`, sans `/api/v1`),
  //   lues par `app/composables/use-cv.ts` (docs/04, F4-04) ;
  // - publiques (`NUXT_PUBLIC_*`) : adresse du bouton « Lancer l'entretien » (aucune vraie adresse
  //   dans le dépôt ; vide ou invalide, la génération échoue).
  runtimeConfig: {
    cvSource: '',
    apiBaseUrl: '',
    public: {
      contactEmail: '',
    },
  },

  i18n: {
    // FR par défaut sans préfixe, EN sous /en (docs/02, F0-05).
    strategy: 'prefix_except_default',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr', name: 'Français', files: filesOf('fr') },
      { code: 'en', language: 'en', name: 'English', files: filesOf('en') },
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
