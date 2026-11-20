import { expect, test, type Page } from '@playwright/test';

// Démarrage de la page générée (lot F3a), indépendant de son contenu :
// - D5 : le script de thème en tête pose les attributs de <html> depuis le réglage enregistré et le
//   système AVANT le premier affichage. Preuves : avec le JavaScript de l'application bloqué (seul le
//   script en ligne s'exécute), les attributs et les couleurs sont déjà ceux du réglage ; avec
//   l'application, chaque attribut est posé avant que <body> n'existe et ne change plus ensuite ;
// - D15 : `/fr` renvoie vers `/` (page de redirection générée par Nitro).

const STORAGE_KEY = 'siteperso:preferences';

/** Fond et texte attendus de la racine (design-tokens.json du handoff). */
const BACKGROUND = {
  sombre: 'rgb(16, 26, 33)',
  clair: 'rgb(230, 235, 229)',
  'sombre-renforce': 'rgb(10, 17, 22)',
  'clair-renforce': 'rgb(255, 255, 255)',
} as const;

const ALL_ON = {
  version: 1,
  theme: 'clair',
  textSize: 130,
  highContrast: true,
  readableFont: true,
  textSpacing: true,
  underlineLinks: true,
  reduceMotion: true,
};

const ATTRIBUTES = [
  'data-theme',
  'data-contrast',
  'data-text-size',
  'data-font',
  'data-spacing',
  'data-links',
  'data-motion',
] as const;

/** Enregistre un document de préférences (ou un texte brut) avant tout script de la page. */
async function store(page: Page, value: string | null): Promise<void> {
  await page.addInitScript(
    ({ key, raw }) => {
      if (raw === null) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    },
    { key: STORAGE_KEY, raw: value },
  );
}

async function rootAttributes(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(
    (names) =>
      Object.fromEntries(names.map((name) => [name, document.documentElement.getAttribute(name)])),
    [...ATTRIBUTES],
  );
}

async function background(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
}

test.describe('D5 : script de thème, application bloquée', () => {
  let blocked: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Seul le script en ligne de <head> s'exécute : aucun module de Nuxt n'est chargé.
    blocked = [];
    await page.route('**/_nuxt/**/*.js', (route) => {
      blocked.push(route.request().url());
      return route.abort();
    });
  });

  test.afterEach(() => {
    // Témoin : l'application a bien été empêchée de démarrer (son point d'entrée a été refusé).
    expect(blocked.length).toBeGreaterThan(0);
  });

  test('sans réglage, système sombre : thème sombre et animations normales', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await store(page, null);
    await page.goto('/');

    expect(await rootAttributes(page)).toEqual({
      'data-theme': 'sombre',
      'data-contrast': null,
      'data-text-size': '100',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'normal',
    });
    expect(await background(page)).toBe(BACKGROUND.sombre);
  });

  test('sans réglage, système clair et mouvement réduit', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await store(page, null);
    await page.goto('/en');

    expect(await rootAttributes(page)).toMatchObject({
      'data-theme': 'clair',
      'data-motion': 'reduit',
    });
    expect(await background(page)).toBe(BACKGROUND.clair);
  });

  test('réglage enregistré, contraire au système : il l’emporte, tous les réglages posés', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await store(page, JSON.stringify(ALL_ON));
    await page.goto('/');

    expect(await rootAttributes(page)).toEqual({
      'data-theme': 'clair',
      'data-contrast': 'renforce',
      'data-text-size': '130',
      'data-font': 'lisible',
      'data-spacing': 'augmente',
      'data-links': 'soulignes',
      'data-motion': 'reduit',
    });
    expect(await background(page)).toBe(BACKGROUND['clair-renforce']);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
      '20.8px',
    );
  });

  test('document illisible : valeurs du système, sans erreur', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: 'light' });
    await store(page, '{pas du JSON');
    await page.goto('/');

    expect(await rootAttributes(page)).toMatchObject({
      'data-theme': 'clair',
      'data-text-size': '100',
    });
    expect(errors).toEqual([]);
  });
});

test.describe('D5 : avec l’application', () => {
  test('chaque attribut est posé avant <body>, puis ne change plus à l’hydratation', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await store(page, JSON.stringify({ ...ALL_ON, theme: 'sombre', highContrast: false }));
    // Observateur installé avant le script de thème : chaque changement d'attribut de <html>, et si
    // <body> existait déjà à ce moment (l'observateur s'exécute juste après le script en ligne).
    await page.addInitScript(() => {
      const log: { name: string; value: string | null; beforeBody: boolean }[] = [];
      Object.assign(window, { __rootMutations: log });
      // <html> n'existe pas encore quand ce script s'exécute : on observe le document entier.
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.target !== document.documentElement) continue;
          const name = record.attributeName ?? '';
          log.push({
            name,
            value: document.documentElement.getAttribute(name),
            beforeBody: document.body === null,
          });
        }
      }).observe(document, { attributes: true, subtree: true });
    });
    await page.goto('/');
    // Hydratation terminée : l'application a monté et appliqué ses préférences.
    await page.waitForFunction(() => document.querySelector('#__nuxt')?.childElementCount !== 0);
    await page.waitForLoadState('networkidle');

    const log = await page.evaluate(
      () =>
        (
          window as unknown as {
            __rootMutations: { name: string; value: string | null; beforeBody: boolean }[];
          }
        ).__rootMutations,
    );
    const final = await rootAttributes(page);
    expect(final).toMatchObject({
      'data-theme': 'sombre',
      'data-text-size': '130',
      'data-font': 'lisible',
      'data-motion': 'reduit',
    });
    for (const name of ['data-theme', 'data-text-size', 'data-font', 'data-motion']) {
      const changes = log.filter((entry) => entry.name === name);
      expect(changes.length, name).toBeGreaterThan(0);
      expect(changes[0]?.beforeBody, name).toBe(true);
      // Jamais une autre valeur que la valeur finale : pas d'aller-retour visible.
      expect(new Set(changes.map((entry) => entry.value)), name).toEqual(new Set([final[name]]));
    }
  });
});

test.describe('D15 : /fr', () => {
  for (const [from, to] of [
    ['/fr', '/'],
    ['/fr/', '/'],
  ] as const) {
    test(`${from} renvoie vers ${to}`, async ({ page, baseURL }) => {
      await page.goto(from);

      await expect(page).toHaveURL(`${baseURL}${to}`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    });
  }
});
