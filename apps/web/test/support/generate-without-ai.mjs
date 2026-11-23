// Génération de test du site SANS section IA (lots F8 et F8b, D27/D28), pour `test/ai-placeholder.e2e.ts`.
//
// Les fixtures du dépôt ont toutes une section IA : on en dérive ici, sans les modifier, une source où
// `aiOverview` est nul, servie par un petit serveur HTTP local qui imite `GET /api/v1/cv?lang=`.
// `nuxt generate` lit cette « API » (source `api`, comme en production), puis le site produit est rangé
// dans `node_modules/.cache/site-sans-ia/` (ignoré par git, hors lint et Prettier), que le parcours sert
// lui-même sur un port libre.
//
// Le site déjà généré dans `.output/public` (fixtures, servi par Playwright aux autres parcours) est mis
// de côté pendant la génération puis remis en place, même en cas d'échec : l'ordre des générations ne
// compte pas et un seul `nuxt generate` s'ajoute à la chaîne `test:e2e`.
//
// Usage (depuis apps/web) : `pnpm run generate:without-ai`.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const webRoot = resolve(import.meta.dirname, '../..');
const publicDir = resolve(webRoot, '.output/public');
const cacheDir = resolve(webRoot, 'node_modules/.cache');
const outputDir = resolve(cacheDir, 'site-sans-ia');
const savedDir = resolve(cacheDir, 'site-habituel-de-cote');

/** CV d'une langue sans section IA : la fixture du dépôt dont `aiOverview` est nul. */
async function cvWithoutAi(locale) {
  const module = await import(
    pathToFileURL(resolve(webRoot, `app/data/fixtures/cv.${locale}.ts`)).href
  );
  return { ...module[locale === 'fr' ? 'cvFr' : 'cvEn'], aiOverview: null };
}

/** `nuxt generate` asynchrone : le serveur local doit répondre pendant que le build lit « l'API ». */
function generate(apiBaseUrl) {
  return new Promise((done, fail) => {
    const child = spawn('pnpm', ['exec', 'nuxt', 'generate'], {
      cwd: webRoot,
      env: {
        ...process.env,
        NUXT_PUBLIC_CONTACT_EMAIL: 'contact@example.org',
        NUXT_CV_SOURCE: 'api',
        NUXT_API_BASE_URL: apiBaseUrl,
      },
      stdio: 'inherit',
    });
    child.on('error', fail);
    child.on('exit', (status) =>
      status === 0 ? done() : fail(new Error(`nuxt generate (site sans IA) a échoué (${status})`)),
    );
  });
}

const cvs = { fr: await cvWithoutAi('fr'), en: await cvWithoutAi('en') };
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const lang = url.searchParams.get('lang');
  const cv = url.pathname === '/api/v1/cv' && (lang === 'fr' || lang === 'en') ? cvs[lang] : null;
  response.writeHead(cv === null ? 404 : 200, {
    'Content-Type': cv === null ? 'application/problem+json' : 'application/json',
  });
  response.end(JSON.stringify(cv ?? { status: 404, detail: 'Ressource inconnue.' }));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));

mkdirSync(cacheDir, { recursive: true });
rmSync(savedDir, { recursive: true, force: true });
const hadSite = existsSync(publicDir);
if (hadSite) renameSync(publicDir, savedDir);
try {
  await generate(`http://127.0.0.1:${server.address().port}`);
  rmSync(outputDir, { recursive: true, force: true });
  renameSync(publicDir, outputDir);
} finally {
  server.close();
  if (hadSite) {
    rmSync(publicDir, { recursive: true, force: true });
    mkdirSync(resolve(publicDir, '..'), { recursive: true });
    renameSync(savedDir, publicDir);
  }
}
