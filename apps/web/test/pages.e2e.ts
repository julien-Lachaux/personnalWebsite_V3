import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Pages annexes et référencement (lot F7), à chaque taille d'écran des maquettes :
// - déclaration d'accessibilité en français et en anglais : rubriques du RGAA, liens, méta, axe ;
// - pages 404 : le serveur statique des tests répond 404 à une adresse inconnue ; le proxy de
//   production (Caddy, BF-14) y sert `404.html` (ou `en/404.html` sous /en) avec ce statut, ce que
//   `page.route` reproduit ici : la page hydratée garde l'adresse demandée, est dans la langue de
//   l'adresse, n'est pas indexable, et passe axe ;
// - `robots.txt` et `sitemap.xml` servis et cohérents avec les liens canonique et hreflang des pages ;
// - version anglaise : aucun libellé d'interface français dans les pages /en (texte et noms
//   accessibles), hors passages marqués `lang="fr"`.

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PUBLIC_DIR = join(import.meta.dirname, '../.output/public');
const LOCALES_DIR = join(import.meta.dirname, '../i18n/locales');

/** Attend l'hydratation (application Vue montée sur #__nuxt). */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector<Element & { __vue_app__?: unknown }>('#__nuxt');
    return root?.__vue_app__ !== undefined;
  });
}

async function axe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(results.violations).toEqual([]);
  expect(results.passes.length).toBeGreaterThan(0);
}

/** Adresse canonique de la page d'accueil : origine de toutes les adresses absolues du site. */
async function siteOrigin(page: Page): Promise<string> {
  await page.goto('/');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).not.toBeNull();
  return new URL(canonical ?? '').origin;
}

/** Méta et liens de référencement de la page courante. */
async function seo(page: Page) {
  return page.evaluate(() => {
    const meta = (selector: string): string | null =>
      document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
    return {
      title: document.title,
      description: meta('name="description"'),
      robots: meta('name="robots"'),
      ogTitle: meta('property="og:title"'),
      ogDescription: meta('property="og:description"'),
      ogType: meta('property="og:type"'),
      ogUrl: meta('property="og:url"'),
      ogLocale: meta('property="og:locale"'),
      ogImage: meta('property="og:image"'),
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      alternates: Object.fromEntries(
        [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map(
          (link): [string, string | null] => [
            link.getAttribute('hreflang') ?? '',
            link.getAttribute('href'),
          ],
        ),
      ),
    };
  });
}

const DECLARATIONS = [
  {
    locale: 'fr',
    path: '/accessibilite',
    other: '/en/accessibility',
    home: '/',
    title: 'Déclaration d’accessibilité',
    back: 'Retour à l’accueil',
    sections: [
      'État de conformité',
      'Référentiel visé',
      'Technologies utilisées',
      'Environnement de test',
      'Contenus non accessibles',
      'Retour d’information et contact',
      'Voies de recours',
    ],
    status: 'non conforme',
    contact: 'M’écrire par e-mail',
    subject: 'Accessibilité du site',
    languageLink: 'EN',
  },
  {
    locale: 'en',
    path: '/en/accessibility',
    other: '/accessibilite',
    home: '/en',
    title: 'Accessibility statement',
    back: 'Back to the home page',
    sections: [
      'Compliance status',
      'Target standard',
      'Technologies used',
      'Test environment',
      'Inaccessible content',
      'Feedback and contact',
      'How to seek redress',
    ],
    status: 'non-compliant',
    contact: 'Email me',
    subject: 'Website accessibility',
    languageLink: 'FR',
  },
] as const;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`déclaration d’accessibilité, schéma ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const declaration of DECLARATIONS) {
      test(`${declaration.path} (${declaration.locale}) : rubriques, liens, méta, axe`, async ({
        page,
      }) => {
        const origin = await siteOrigin(page);
        const response = await page.goto(declaration.path);
        expect(response?.status()).toBe(200);
        await hydrated(page);

        await expect(page.locator('html')).toHaveAttribute('lang', declaration.locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(declaration.title);
        await expect(page.getByRole('heading', { level: 2 })).toHaveText([...declaration.sections]);
        await expect(page.locator('main#contenu')).toHaveCount(1);
        await expect(page.getByRole('banner')).toHaveCount(1);
        await expect(page.locator('main strong')).toHaveText(declaration.status);

        // Liens : retour à l'accueil, contact (mailto de la configuration, sans adresse affichée),
        // Défenseur des droits (pages en français).
        const main = page.getByRole('main');
        await expect(main.getByRole('link', { name: declaration.back })).toHaveAttribute(
          'href',
          declaration.home,
        );
        await expect(main.getByRole('link', { name: declaration.contact })).toHaveAttribute(
          'href',
          `mailto:contact@example.org?subject=${encodeURIComponent(declaration.subject)}`,
        );
        await expect(main).not.toContainText('contact@example.org');
        const external = main.locator('a[href^="https://"]');
        await expect(external).toHaveCount(2);
        for (const link of await external.all()) {
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
          await expect(link).toHaveAttribute('hreflang', 'fr');
          expect(new URL((await link.getAttribute('href')) ?? '').hostname).toBe(
            'www.defenseurdesdroits.fr',
          );
        }

        // Référencement : titre et description propres, Open Graph minimal, canonique et hreflang.
        const meta = await seo(page);
        expect(meta.title).toBe(declaration.title);
        expect(meta.description).toBeTruthy();
        expect(meta.ogTitle).toBe(declaration.title);
        expect(meta.ogDescription).toBe(meta.description);
        expect(meta.ogType).toBe('website');
        expect(meta.ogUrl).toBe(`${origin}${declaration.path}`);
        expect(meta.ogLocale).toBe(declaration.locale);
        expect(meta.ogImage).toBeNull();
        expect(meta.robots).toBeNull();
        expect(meta.canonical).toBe(`${origin}${declaration.path}`);
        expect(meta.alternates).toEqual({
          fr: `${origin}/accessibilite`,
          en: `${origin}/en/accessibility`,
          'x-default': `${origin}/accessibilite`,
        });

        await axe(page);

        // En-tête du site : nom du site vers l'accueil, puis la même page dans l'autre langue.
        const banner = page.getByRole('banner');
        await expect(banner.getByRole('link', { name: /^julien-lachaux/ })).toHaveAttribute(
          'href',
          declaration.home,
        );
        await banner.getByRole('link', { name: declaration.languageLink, exact: true }).click();
        await expect(page).toHaveURL(declaration.other);
      });
    }
  });
}

const NOT_FOUND = [
  {
    locale: 'fr',
    path: '/page-inconnue',
    file: '404.html',
    title: 'Page introuvable',
    back: 'Retour à l’accueil',
    home: '/',
    homeHeading: 'Développeur full-stack',
  },
  {
    locale: 'en',
    path: '/en/unknown-page',
    file: 'en/404.html',
    title: 'Page not found',
    back: 'Back to the home page',
    home: '/en',
    homeHeading: 'Full-stack developer',
  },
] as const;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`page 404, schéma ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const notFound of NOT_FOUND) {
      test(`${notFound.path} (${notFound.locale}) : statut 404, page de la langue, axe`, async ({
        page,
        request,
      }) => {
        // Le site généré n'a aucune page à cette adresse.
        expect((await request.get(notFound.path)).status()).toBe(404);

        // Comportement du proxy de production : la page 404 de la langue, avec le statut 404.
        const body = readFileSync(join(PUBLIC_DIR, notFound.file), 'utf8');
        await page.route(`**${notFound.path}`, (route) =>
          route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body }),
        );
        const response = await page.goto(notFound.path);
        expect(response?.status()).toBe(404);
        await hydrated(page);

        await expect(page).toHaveURL(notFound.path);
        await expect(page.locator('html')).toHaveAttribute('lang', notFound.locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(notFound.title);
        await expect(page.getByRole('banner')).toHaveCount(1);
        await expect(page.locator('a, button').first()).toHaveClass(/skip-link/);

        const meta = await seo(page);
        expect(meta.title).toBe(notFound.title);
        expect(meta.robots).toBe('noindex');
        expect(meta.canonical).toBeNull();
        expect(meta.alternates).toEqual({});

        await axe(page);

        // Le retour à l'accueil quitte la page d'erreur.
        await page.getByRole('main').getByRole('link', { name: notFound.back }).click();
        await expect(page).toHaveURL(notFound.home);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(notFound.homeHeading);
      });
    }
  });
}

test('robots.txt ouvre le site et annonce le plan du site de son origine', async ({
  page,
  request,
}) => {
  const origin = await siteOrigin(page);
  const response = await request.get('/robots.txt');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  expect(await response.text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
});

test('sitemap.xml liste chaque page en fr et en, avec les hreflang que chaque page déclare', async ({
  page,
  request,
}) => {
  const origin = await siteOrigin(page);
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');

  const xml = await response.text();
  const entries = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    if (document.querySelector('parsererror') !== null) return null;
    return [...document.getElementsByTagName('url')].map((url) => ({
      loc: url.getElementsByTagName('loc')[0]?.textContent ?? '',
      alternates: Object.fromEntries(
        [...url.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')].map(
          (link): [string, string | null] => [
            link.getAttribute('hreflang') ?? '',
            link.getAttribute('href'),
          ],
        ),
      ),
    }));
  }, xml);

  expect(entries?.map((entry) => entry.loc)).toEqual([
    origin,
    `${origin}/accessibilite`,
    `${origin}/en`,
    `${origin}/en/accessibility`,
  ]);
  for (const entry of entries ?? []) {
    const path = new URL(entry.loc).pathname;
    expect((await page.goto(path))?.status(), path).toBe(200);
    const meta = await seo(page);
    expect(meta.canonical, path).toBe(entry.loc);
    expect(entry.alternates, path).toEqual(meta.alternates);
    expect(Object.keys(entry.alternates).sort(), path).toEqual(['en', 'fr', 'x-default']);
  }
});

// Version anglaise : fragments des libellés français absents de tout libellé anglais (les morceaux
// entre paramètres `{…}`), cherchés comme mots entiers, en respectant la casse.
interface Messages {
  [key: string]: Messages | string | unknown[];
}

function leaves(messages: Messages): string[] {
  return Object.values(messages).flatMap((value) =>
    typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : leaves(value),
  );
}

function labels(language: string): string[] {
  return readdirSync(join(LOCALES_DIR, language)).flatMap((file) =>
    leaves(JSON.parse(readFileSync(join(LOCALES_DIR, language, file), 'utf8')) as Messages),
  );
}

const english = labels('en');
const frenchOnly = [
  ...new Set(
    labels('fr')
      .flatMap((label) => label.split(/\{[^}]*\}/))
      .map((fragment) => fragment.trim().replace(/[\s:;,.]+$/u, ''))
      .filter((fragment) => /\p{L}/u.test(fragment))
      .filter((fragment) => !english.some((label) => label.includes(fragment))),
  ),
];

test('les libellés français à chercher dans les pages anglaises sont relevés', () => {
  expect(frenchOnly).toContain('Aller au contenu');
  expect(frenchOnly).toContain('Déclaration d’accessibilité');
  expect(frenchOnly).not.toContain('XP');
  expect(frenchOnly).not.toContain('CV PDF');
});

const ENGLISH_PAGES = [
  { path: '/en', file: null },
  { path: '/en/accessibility', file: null },
  { path: '/en/unknown-page', file: 'en/404.html' },
] as const;

for (const { path, file } of ENGLISH_PAGES) {
  test(`${path} : aucun libellé d’interface français (texte, noms accessibles, titre)`, async ({
    page,
  }) => {
    if (file !== null) {
      const body = readFileSync(join(PUBLIC_DIR, file), 'utf8');
      await page.route(`**${path}`, (route) =>
        route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body }),
      );
    }
    await page.goto(path);
    await hydrated(page);

    const texts = await page.evaluate(() => {
      /** Vrai hors des passages marqués dans une autre langue que l'anglais. */
      const english = (element: Element | null): boolean =>
        (element?.closest('[lang]')?.getAttribute('lang') ?? 'en').startsWith('en');
      const found: string[] = [document.title];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (parent?.closest('script, style, noscript') !== null) continue;
        if (english(parent)) found.push(node.textContent ?? '');
      }
      for (const element of document.body.querySelectorAll(
        '[aria-label], [title], [alt], [placeholder], [aria-description]',
      )) {
        if (!english(element)) continue;
        for (const name of ['aria-label', 'title', 'alt', 'placeholder', 'aria-description']) {
          const value = element.getAttribute(name);
          if (value !== null) found.push(value);
        }
      }
      const description = document.head.querySelector('meta[name="description"]');
      found.push(description?.getAttribute('content') ?? '');
      return found;
    });

    const offenders = frenchOnly.filter((fragment) => {
      const word = new RegExp(
        `(?<!\\p{L})${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`,
        'u',
      );
      return texts.some((text) => word.test(text));
    });
    expect(offenders).toEqual([]);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
}
