// Configuration Nuxt 4 du front (docs/05, D1 et D2) : génération statique (`nuxt generate`) des
// pages FR (sans préfixe) et EN (`/en/...`) ; aucun serveur Node du front en production.
// Fichier partagé : réservé au lead-architecte (règle « modules isolés » du front, CLAUDE.md).

import { readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isLocalizedErrorPage, LOCALIZED_ERROR_PAGES } from './app/domain/error-pages';
import {
  isServerErrorPage,
  SERVER_ERROR_PAGES,
  standaloneErrorPage,
} from './app/domain/server-error-page';
import { seoFiles, SITEMAP_FILE } from './app/domain/sitemap';
import { themeScript } from './app/domain/theme-script';

// Libellés d'interface : un fichier commun et un fichier par section et par langue
// (i18n/locales/<langue>/<fichier>.json), pour que deux agents de section en parallèle n'écrivent
// jamais le même fichier (décision du 20 nov. 2026). Chaque fichier de section ne contient que
// l'espace de clés de sa section ; @nuxtjs/i18n les charge dans l'ordre et les fusionne.
const messageFiles = ['common', 'shell', 'profile', 'experience', 'recommendations', 'ai'];
const filesOf = (language: string): string[] =>
  messageFiles.map((name) => `${language}/${name}.json`);

// CV PDF présents dans public/cv/ (D22), relevés à chaque build : le bouton « CV PDF » d'une langue
// sans CV mène au CV français (app/domain/cv-link.ts) ; déposer `cv-<langue>.pdf` suffit à y mettre fin.
const cvFiles = readdirSync(new URL('./public/cv/', import.meta.url))
  .filter((name) => name.endsWith('.pdf'))
  .sort();

// Plan du site et robots.txt (lot F7, F7-03) : HTML des pages prérendues, relevé au fil du prérendu ;
// les deux fichiers en sont déduits à la fin (app/domain/sitemap.ts) et écrits à la racine du site.
const prerenderedPages: string[] = [];

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
  // Page 404 de la langue par défaut rendue côté serveur au prérendu (`/404.html`), au lieu d'une coquille
  // SPA vide ; celle des autres langues est prérendue en plus (`nitro`, plus bas). Lot F7, F7-01.
  experimental: { prerenderErrorPages: [404] },
  // L'API de dev écoute sur 3000 et autorise l'origine http://localhost:3001 (CORS_ORIGIN).
  devServer: { port: 3001 },

  // Design system global (lot F1) : polices auto-hébergées (D6), tokens et thèmes du handoff, tokens
  // ajoutés par décision (bordure des contrôles, D12), base, animations nommées (glissement des onglets,
  // F3a). L'ordre compte : les tokens définissent les variables que la base utilise. Interface
  // préférences → CSS : les attributs `data-*` de <html>, décrits en tête de app/assets/css/tokens.css.
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/tokens.css',
    '~/assets/css/control-tokens.css',
    '~/assets/css/base.css',
    '~/assets/css/motion.css',
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
  //   dans le dépôt ; vide ou invalide, la génération échoue) ; noms des CV de public/cv/ (relevés
  //   ci-dessus, pas une variable d'environnement à poser).
  runtimeConfig: {
    cvSource: '',
    apiBaseUrl: '',
    public: {
      contactEmail: '',
      cvFiles,
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
    // Chemins anglais propres à une page (lot F7) : clé = nom de la route de la page française.
    customRoutes: 'config',
    pages: {
      accessibilite: { en: '/accessibility' },
    },
  },

  // D15 : la langue par défaut n'a pas de préfixe ; `/fr` et `/fr/...` renvoient vers la même page
  // sans préfixe. En génération statique, Nitro écrit pour chaque route redirigée prérendue une page
  // de redirection (`<meta http-equiv="refresh">`) ; le proxy de production double la règle par une
  // vraie redirection HTTP (F9, Caddy).
  routeRules: {
    '/fr': { redirect: { to: '/', statusCode: 301 } },
    '/fr/**': { redirect: { to: '/**', statusCode: 301 } },
    // Gabarit des pages annexes (en-tête du site, layouts/annex.vue), lot F7.
    '/accessibilite': { appLayout: 'annex' },
    '/en/accessibility': { appLayout: 'annex' },
  },

  nitro: {
    prerender: {
      // Pages 404 des autres langues (`/en/404.html`) en plus de celles qu'atteint le robot (lot F7) ;
      // pages d'erreur serveur `/50x.html` et `/en/50x.html` (lot 30).
      routes: [
        '/',
        '/en',
        '/fr',
        '/fr/accessibilite',
        ...LOCALIZED_ERROR_PAGES,
        ...SERVER_ERROR_PAGES,
      ],
      crawlLinks: true,
      failOnError: true,
    },
    hooks: {
      // Une page 404 d'une autre langue est rendue avec le statut 404 : le prérendu la garde (sans
      // cela, `failOnError` arrête la génération) ; toute autre erreur reste une erreur.
      //
      // Page d'erreur serveur (lot 30) : rendue de même par error.vue (statut 404 de son adresse), puis
      // privée de l'application de Nuxt (scripts et préchargements, sauf le script de thème) pour
      // s'afficher sans JavaScript ni serveur, à n'importe quelle adresse (app/domain/server-error-page.ts).
      'prerender:generate'(route) {
        if (isLocalizedErrorPage(route.route) && route.error?.statusCode === 404)
          delete route.error;
        if (isServerErrorPage(route.route) && route.error?.statusCode === 404) {
          delete route.error;
          route.contents = standaloneErrorPage(route.contents ?? '', themeScript());
        }
      },
      'prerender:route'(route) {
        if (route.error === undefined && route.fileName?.endsWith('.html') && route.contents) {
          prerenderedPages.push(route.contents);
        }
      },
    },
  },

  hooks: {
    // Fin du prérendu : `sitemap.xml` et `robots.txt` à la racine du site généré (lot F7, F7-03).
    'nitro:init'(nitro) {
      nitro.hooks.hook('prerender:done', async () => {
        const { sitemap, robots } = seoFiles(prerenderedPages);
        const publicDir = nitro.options.output.publicDir;
        await writeFile(join(publicDir, SITEMAP_FILE), sitemap);
        await writeFile(join(publicDir, 'robots.txt'), robots);
      });
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
