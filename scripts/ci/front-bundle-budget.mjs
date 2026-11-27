#!/usr/bin/env node
// Mesures du JavaScript du site généré (lot F11, F11-06, décision D50), lancées sur `.output/public`.
//   front-bundle-budget.mjs [site] [dossier des fixtures]
//   (défauts : apps/web/.output/public, apps/web/app/data/fixtures)
// Échoue (code 1, message en français) si :
//   - un script de `_nuxt/*.js` contient Zod, la lecture de l'API du CV ou un texte des fixtures ;
//   - le JS chargé par la page d'accueil (`/`, gzip) dépasse le budget ci-dessous.
// Affiche un tableau Markdown (poids total publié, JS chargé par page, bruts et gzip) dans
// `$GITHUB_STEP_SUMMARY` s'il est posé, sinon sur la sortie standard. Aucune dépendance.
//
// Même méthode que `apps/web/test/client-bundle.e2e.ts` (F11-01), qui reste le parcours de référence.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Budget du JS chargé par la page d'accueil, en octets gzip (niveau 9).
 * Valeur mesurée à la fin du lot F11 (26 nov. 2026, 8 scripts, 390 965 o bruts) : 138 460 o ;
 * budget = cette valeur + 10 % (D50), arrondi à l'octet supérieur : 152 306 o.
 * Seul Julien décide de le relever (décision à consigner dans docs/05-front-organisation.md) : on mesure
 * alors de nouveau la page d'accueil du site généré et on remplace la valeur et sa date ici.
 */
const HOME_JS_BUDGET_GZIP = 152_306;

/** Pages mesurées : la première porte le budget, les autres sont données pour information. */
const PAGES = [
  { route: '/', file: 'index.html' },
  { route: '/en', file: 'en/index.html' },
  { route: '/accessibilite', file: 'accessibilite/index.html' },
];

/** Marques de Zod 4 qu'un minificateur garde : propriété interne des schémas, nom de l'erreur. */
const ZOD_MARKERS = ['._zod.', 'ZodError'];
/** Marques de la lecture du CV (`app/data/api-cv-source.ts` et `parse-cv.ts`). */
const SOURCE_MARKERS = ['/api/v1/cv', 'Réponse non conforme au contrat Cv'];
/** Textes des fixtures assez longs pour n'apparaître dans aucun code. */
const MIN_FIXTURE_TEXT = 40;

const [siteArg = 'apps/web/.output/public', fixturesArg = 'apps/web/app/data/fixtures'] =
  process.argv.slice(2);
const site = resolve(siteArg);
const fixturesDir = resolve(fixturesArg);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const gzipSize = (buffer) => gzipSync(buffer, { level: 9 }).length;
const ko = (octets) => `${(octets / 1000).toFixed(1)} ko`;
const both = ({ raw, gzip }) => `${ko(raw)} / ${ko(gzip)}`;

/** Textes en littéral (apostrophes, guillemets) des fichiers `cv.*.ts`, assez longs pour être des contenus. */
function fixtureTexts(dir) {
  if (!existsSync(dir)) fail(`Dossier des fixtures absent : ${dir}`);
  const files = readdirSync(dir).filter(
    (name) => /^cv\..+\.ts$/.test(name) && !name.endsWith('.spec.ts'),
  );
  if (files.length === 0) fail(`Aucune fixture cv.*.ts dans ${dir}`);
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
  const texts = new Set();
  for (const name of files) {
    const source = readFileSync(join(dir, name), 'utf8');
    for (const match of source.matchAll(literal)) {
      const text = (match[1] ?? match[2]).replace(/\\(.)/g, '$1');
      if (text.length >= MIN_FIXTURE_TEXT) texts.add(text);
    }
  }
  // Témoin : sans textes, l'absence relevée dans les scripts ne prouverait rien.
  if (texts.size < 10) fail(`Trop peu de textes de fixtures lus dans ${dir} (${texts.size}).`);
  return [...texts];
}

const nuxtDir = join(site, '_nuxt');
if (!existsSync(join(site, 'index.html')) || !existsSync(nuxtDir)) {
  fail(`Site généré absent : ${site} (lancer \`pnpm --filter @siteperso/web generate:fixtures\`).`);
}

/** Scripts publiés : taille brute, taille gzip, texte. */
const scripts = new Map();
for (const name of readdirSync(nuxtDir)
  .filter((file) => file.endsWith('.js'))
  .sort()) {
  const buffer = readFileSync(join(nuxtDir, name));
  scripts.set(name, { raw: buffer.length, gzip: gzipSize(buffer), text: buffer.toString('utf8') });
}
if (scripts.size === 0) fail(`Aucun script dans ${nuxtDir}`);

const sum = (names) =>
  [...names].reduce(
    (total, name) => ({
      raw: total.raw + scripts.get(name).raw,
      gzip: total.gzip + scripts.get(name).gzip,
    }),
    { raw: 0, gzip: 0 },
  );

/** Scripts chargés par une page : script d'entrée et `modulepreload`, chacun une seule fois. */
function loadedBy(file) {
  const html = readFileSync(join(site, file), 'utf8');
  const preload = /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="\/_nuxt\/([^"]+\.js)"/g;
  const entry = /<script\b[^>]*\bsrc="\/_nuxt\/([^"]+\.js)"/g;
  const names = new Set(
    [...html.matchAll(preload), ...html.matchAll(entry)].map((match) => match[1]),
  );
  for (const name of names) {
    if (!scripts.has(name)) fail(`${file} charge /_nuxt/${name}, absent du site généré.`);
  }
  return names;
}

const problems = [];

// 1. Ni Zod, ni la lecture du CV, ni les fixtures dans un script.
const checks = [
  ['Zod', ZOD_MARKERS],
  ['la lecture de l’API du CV', SOURCE_MARKERS],
  ['les fixtures du CV', fixtureTexts(fixturesDir)],
];
for (const [label, markers] of checks) {
  for (const [name, { text }] of scripts) {
    const found = markers.filter((marker) => text.includes(marker));
    if (found.length > 0) {
      const sample = found[0].length > 60 ? `${found[0].slice(0, 60)}…` : found[0];
      problems.push(
        `Le script _nuxt/${name} contient ${label} (${found.length} marque(s), ex. « ${sample} »).`,
      );
    }
  }
}

// 2. Mesures par page et budget de la page d'accueil.
const rows = PAGES.filter(({ file }) => existsSync(join(site, file))).map(({ route, file }) => {
  const names = loadedBy(file);
  return { route, count: names.size, ...sum(names) };
});
const home = rows[0];
const overBudget = home.gzip > HOME_JS_BUDGET_GZIP;
if (overBudget) {
  problems.push(
    `Le JS chargé par la page d'accueil pèse ${home.gzip} o gzip, au-dessus du budget de ` +
      `${HOME_JS_BUDGET_GZIP} o (+${home.gzip - HOME_JS_BUDGET_GZIP} o). Seul Julien relève le budget (D50).`,
  );
}

const total = sum(scripts.keys());
const budgetCell = `${ko(HOME_JS_BUDGET_GZIP)} (${overBudget ? 'DÉPASSÉ' : 'respecté'})`;
const lines = [
  '## Poids du JavaScript du site généré (D50)',
  '',
  `Poids total publié (\`_nuxt/*.js\`) : ${scripts.size} scripts, ${both(total)} (bruts / gzip).`,
  '',
  '| Page | Scripts chargés | Bruts / gzip | Budget gzip |',
  '|---|---|---|---|',
  ...rows.map(
    (row) =>
      `| \`${row.route}\` | ${row.count} | ${both(row)} | ${row.route === '/' ? budgetCell : 'information'} |`,
  ),
  '',
  problems.length === 0
    ? 'Aucune trace de Zod, de la lecture du CV ni des fixtures dans les scripts.'
    : `**Échec :**\n\n${problems.map((problem) => `- ${problem}`).join('\n')}`,
  '',
];
const report = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
else process.stdout.write(`${report}\n`);

if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.exit(1);
}
