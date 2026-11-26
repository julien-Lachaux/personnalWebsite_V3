import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { CvSchema } from '@siteperso/contracts';
import { expect, test, type Page } from '@playwright/test';

import { BROWSER_CV_SOURCE_MESSAGE } from '../app/data/browser-cv-source.js';
import { cvEn } from '../app/data/fixtures/cv.en.js';
import { cvFr } from '../app/data/fixtures/cv.fr.js';
import { waitForHydration } from './support/e2e.js';

// JavaScript du navigateur (lot F11, F11-01) : le CV est lu à la génération du site, jamais dans le
// navigateur, qui le trouve dans la charge utile de chaque page. Aucun script publié dans `_nuxt/` ne
// contient donc la source du CV : ni les schémas Zod des contrats, ni la lecture de l'API, ni les
// fixtures, quelle que soit la source de la génération. Deux sites générés sont relus :
// - `.output/public` : source `fixtures` (`generate:fixtures`, celui des autres parcours) ;
// - `node_modules/.cache/site-sans-ia` : source `api`, comme en production (`generate:without-ai`).
// Témoins : chaque marque cherchée est vérifiée sur ce qu'elle désigne (schéma Zod réel, fichier
// source, fixture), pour que l'absence relevée ne soit pas celle d'une marque qui n'existe nulle part.
//
// Navigation dans l'application : après l'hydratation, un changement de page côté client (langue,
// retour à l'accueil, page « travaux en cours ») lit la charge utile prérendue de la page d'arrivée
// (`_payload.json`) ; le module qui remplace la source dans le navigateur (`browser-cv-source.ts`),
// importé seulement si le gestionnaire de `useAsyncData` s'exécutait, n'est jamais demandé.

const webRoot = resolve(import.meta.dirname, '..');

const SITES = [
  { source: 'fixtures', dir: resolve(webRoot, '.output/public') },
  { source: 'api', dir: resolve(webRoot, 'node_modules/.cache/site-sans-ia') },
] as const;

/** Textes des fixtures assez longs pour n'apparaître dans aucun code (intro, missions, avis…). */
const MIN_FIXTURE_TEXT = 40;

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const fixtureTexts = [...new Set([...strings(cvFr), ...strings(cvEn)])].filter(
  (text) => text.length >= MIN_FIXTURE_TEXT,
);

/** Marques de Zod 4 qu'un minificateur garde : propriété interne des schémas, nom de l'erreur. */
const ZOD_MARKERS = ['._zod.', 'ZodError'] as const;

/** Marques de la lecture du CV, prises dans leur fichier source (`app/data/`). */
const SOURCE_MARKERS = [
  { file: 'app/data/api-cv-source.ts', marker: '/api/v1/cv' },
  { file: 'app/data/parse-cv.ts', marker: 'Réponse non conforme au contrat Cv' },
] as const;

interface Script {
  readonly name: string;
  readonly text: string;
}

function scriptsOf(dir: string): Script[] {
  const nuxtDir = join(dir, '_nuxt');
  if (!existsSync(join(dir, 'index.html')) || !existsSync(nuxtDir)) {
    throw new Error(
      `site généré absent : ${dir} (lancer \`pnpm --filter @siteperso/web test:e2e\`, qui le génère)`,
    );
  }
  const scripts = readdirSync(nuxtDir)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(nuxtDir, name), 'utf8') }));
  if (scripts.length === 0) throw new Error(`aucun script dans ${nuxtDir}`);
  return scripts;
}

/** Scripts qui contiennent l'une des marques, avec la marque trouvée. */
function containing(scripts: readonly Script[], markers: readonly string[]): string[] {
  return scripts.flatMap(({ name, text }) =>
    markers.filter((marker) => text.includes(marker)).map((marker) => `${name} : ${marker}`),
  );
}

test.describe('JavaScript du navigateur sans la source du CV', () => {
  test('témoins : les marques désignent bien Zod, la lecture du CV et les fixtures', () => {
    const parsed = CvSchema.safeParse(null);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.name).toBe('ZodError');
    expect('_zod' in CvSchema).toBe(true);

    for (const { file, marker } of SOURCE_MARKERS) {
      expect(readFileSync(resolve(webRoot, file), 'utf8')).toContain(marker);
    }

    expect(fixtureTexts.length).toBeGreaterThanOrEqual(20);
    expect(fixtureTexts).toContain(cvFr.profile.intro);
    expect(fixtureTexts).toContain(cvEn.profile.intro);
  });

  for (const { source, dir } of SITES) {
    test(`source « ${source} » : aucun script ne contient Zod ni la lecture du CV`, () => {
      const scripts = scriptsOf(dir);

      expect(containing(scripts, ZOD_MARKERS)).toEqual([]);
      expect(
        containing(
          scripts,
          SOURCE_MARKERS.map(({ marker }) => marker),
        ),
      ).toEqual([]);
    });

    test(`source « ${source} » : aucun script ne contient les fixtures`, () => {
      expect(containing(scriptsOf(dir), fixtureTexts)).toEqual([]);
    });
  }
});

/** Script du site qui remplace la source du CV dans le navigateur (un seul, celui du greffon). */
function browserSourceScript(): string {
  const found = scriptsOf(SITES[0].dir).filter(({ text }) =>
    text.includes(BROWSER_CV_SOURCE_MESSAGE),
  );
  expect(found.map(({ name }) => name)).toHaveLength(1);
  return `/_nuxt/${found[0]!.name}`;
}

interface Probe {
  /** Chemins demandés : scripts de `_nuxt/`, charges utiles. */
  readonly requested: string[];
  /** Documents chargés (une navigation client n'en charge aucun). */
  readonly documents: string[];
  readonly errors: string[];
}

function probe(page: Page): Probe {
  const result: Probe = { requested: [], documents: [], errors: [] };
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (request.resourceType() === 'document') result.documents.push(pathname);
    else result.requested.push(pathname);
  });
  page.on('pageerror', (error) => result.errors.push(String(error)));
  return result;
}

const linkedinEn = cvEn.socialLinks.find(({ slug }) => slug === 'linkedin')?.url;

test.describe('navigation côté client : le CV vient de la charge utile', () => {
  const journeys = [
    {
      name: 'accueil, puis la même page en anglais',
      start: '/',
      link: (page: Page) => page.locator('.language-switch:visible').first().getByRole('link'),
      arrival: '/en',
      payload: '/en/_payload.json',
      check: (page: Page) => expect(page.locator('#contenu')).toContainText(cvEn.profile.intro),
    },
    {
      name: 'déclaration d’accessibilité, puis l’accueil par l’en-tête',
      start: '/accessibilite',
      link: (page: Page) => page.getByRole('banner').getByRole('link', { name: /^julien-lachaux/ }),
      arrival: '/',
      payload: '/_payload.json',
      check: (page: Page) => expect(page.locator('#contenu')).toContainText(cvFr.profile.intro),
    },
    {
      name: 'page « travaux en cours », puis la même page en anglais',
      start: '/travaux',
      link: (page: Page) => page.getByRole('banner').getByRole('link', { name: 'EN', exact: true }),
      arrival: '/en/work-in-progress',
      payload: '/en/work-in-progress/_payload.json',
      check: (page: Page) =>
        expect(
          page.getByRole('main').getByRole('link', { name: /^LinkedIn profile/ }),
        ).toHaveAttribute('href', linkedinEn ?? 'lien LinkedIn absent des fixtures'),
    },
  ] as const;

  for (const journey of journeys) {
    test(journey.name, async ({ page }) => {
      const browserSource = browserSourceScript();
      const seen = probe(page);

      await page.goto(journey.start);
      await waitForHydration(page);
      await journey.link(page).click();
      await expect(page).toHaveURL(journey.arrival);
      await journey.check(page);
      await page.waitForLoadState('networkidle');

      // Témoins : un seul document (celui du départ) et la charge utile de l'arrivée demandée.
      expect(seen.documents).toEqual([journey.start]);
      expect(seen.requested).toContain(journey.payload);
      expect(seen.requested).not.toContain(browserSource);
      expect(seen.errors).toEqual([]);
    });
  }
});
