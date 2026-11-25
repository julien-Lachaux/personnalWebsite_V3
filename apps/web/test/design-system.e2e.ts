import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Design system global (lot F1a : F1-01, F1-02, F1-06) dans un vrai navigateur, sur le site généré :
// thèmes et repli sur le schéma du système, contraste renforcé, taille du texte, police lisible
// chargée à la demande, espacement, soulignement, mouvement réduit, focus visible, lien
// d'évitement, masquage visuel. Les attributs de la racine sont l'interface (tête de tokens.css).
// Les éléments de test sont ajoutés dans <body>, hors de la racine de Nuxt (#__nuxt) : l'hydratation
// de Vue retirerait un nœud inconnu ajouté dans <main>.

/** Règles axe des niveaux A et AA de WCAG 2.0, 2.1 et 2.2. */
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Couleurs du handoff v6 (design-tokens.json) attendues après le rendu. */
const PALETTES = {
  sombre: { bg: 'rgb(16, 26, 33)', text: 'rgb(233, 238, 232)', accent: 'rgb(127, 209, 181)' },
  clair: { bg: 'rgb(230, 235, 229)', text: 'rgb(20, 38, 43)', accent: 'rgb(31, 92, 77)' },
  'sombre-renforce': {
    bg: 'rgb(10, 17, 22)',
    text: 'rgb(255, 255, 255)',
    accent: 'rgb(155, 235, 208)',
  },
  'clair-renforce': { bg: 'rgb(255, 255, 255)', text: 'rgb(0, 0, 0)', accent: 'rgb(18, 63, 52)' },
} as const;

type Attributes = Record<string, string | null>;

/**
 * Charge la page et attend son hydratation (la coquille a choisi son mode : `data-mode`). Avant
 * cela, le montage de l'application pose les attributs de <html> selon les préférences (D5) et
 * écraserait ceux qu'un test poserait juste après `goto`.
 */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
}

/** Pose (ou retire, valeur null) des attributs sur <html>, comme le feront les préférences. */
async function setRoot(page: Page, attributes: Attributes): Promise<void> {
  await page.evaluate((entries) => {
    for (const [name, value] of Object.entries(entries)) {
      if (value === null) document.documentElement.removeAttribute(name);
      else document.documentElement.setAttribute(name, value);
    }
  }, attributes);
}

async function rootStyle(page: Page): Promise<{ bg: string; text: string; accent: string }> {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return { bg: style.backgroundColor, text: style.color, accent };
  });
}

/** Durée CSS (`550ms`, `.55s`, `1e-05s`) en millisecondes. */
function milliseconds(value: string): number {
  const match = /^\s*(-?[\d.e+-]+)(ms|s)\s*$/.exec(value);
  if (match?.[1] === undefined) throw new Error(`durée illisible : ${value}`);
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

async function rootVariable(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable),
    name,
  );
}

test.describe('thèmes', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`système ${colorScheme}`, () => {
      test.use({ colorScheme });

      test('sans réglage enregistré, la page suit le schéma du système, avec ou sans data-theme', async ({
        page,
      }) => {
        await open(page, '/');
        const palette = PALETTES[colorScheme === 'dark' ? 'sombre' : 'clair'];

        // D5 : l'application pose toujours data-theme, d'après le schéma du système.
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme === 'dark' ? 'sombre' : 'clair',
        );
        expect(await rootStyle(page)).toEqual(palette);
        // Sans l'attribut (avant tout script), la feuille de style suit encore le système.
        await setRoot(page, { 'data-theme': null });
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        expect(await rootStyle(page)).toEqual(palette);
        expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(
          /^"?Space Grotesk"?,/,
        );
      });

      test('data-theme l’emporte sur le système, data-contrast renforce le thème posé', async ({
        page,
      }) => {
        await open(page, '/');

        for (const [theme, contrast, expected] of [
          ['sombre', null, 'sombre'],
          ['clair', null, 'clair'],
          ['sombre', 'renforce', 'sombre-renforce'],
          ['clair', 'renforce', 'clair-renforce'],
        ] as const) {
          await setRoot(page, { 'data-theme': theme, 'data-contrast': contrast });
          expect(await rootStyle(page), expected).toEqual(PALETTES[expected]);
          expect(
            await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
          ).toBe(theme === 'sombre' ? 'dark' : 'light');
        }
      });
    });
  }

  for (const [theme, contrast] of [
    ['sombre', null],
    ['clair', null],
    ['sombre', 'renforce'],
    ['clair', 'renforce'],
  ] as const) {
    for (const path of ['/', '/en']) {
      test(`axe WCAG 2.2 AA : ${path}, ${theme}${contrast === null ? '' : ', contraste renforcé'}`, async ({
        page,
      }) => {
        await open(page, path);
        await setRoot(page, { 'data-theme': theme, 'data-contrast': contrast });

        // Le changement de thème déclenche des transitions de couleur : mesurer une fois posées (F5D-2).
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (animation) =>
                animation.playState !== 'running' ||
                animation.effect?.getComputedTiming().endTime === Infinity,
            ),
        );
        const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
        expect(results.violations).toEqual([]);
        expect(results.passes.map((rule) => rule.id)).toContain('color-contrast');
      });
    }
  }
});

test.describe('focus, lien d’évitement, masquage visuel', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`focus visible au clavier : 2 px accent, décalé de 2 px (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await open(page, '/');
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      // Premier arrêt : le lien d'évitement (son style a sa propre vérification plus bas) ; le
      // second est le premier contrôle de la page.
      await expect(focused).toHaveClass(/skip-link/);
      await page.keyboard.press('Tab');
      await expect(focused).not.toHaveClass(/skip-link/);
      const outline = await focused.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.outlineStyle, style.outlineWidth, style.outlineOffset, style.outlineColor];
      });
      const { accent } = PALETTES[colorScheme === 'dark' ? 'sombre' : 'clair'];
      expect(outline).toEqual(['solid', '2px', '2px', accent]);
    });
  }

  test('le lien d’évitement est hors de l’écran, puis visible au focus', async ({ page }) => {
    await open(page, '/');
    // Le lien de l'application (app.vue), pas un lien ajouté par le test.
    const link = page.locator('.skip-link');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', '#contenu');
    await expect(link).toHaveText('Aller au contenu');

    const hidden = await link.boundingBox();
    expect(hidden?.y ?? 0).toBeLessThan(-(hidden?.height ?? 0) + 1);

    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const shown = await link.boundingBox();
    expect(shown?.y).toBeGreaterThan(0);
    expect(shown?.height).toBeGreaterThan(0);
    await expect(link).toBeInViewport({ ratio: 1 });
    const colors = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.color];
    });
    const { accent } = PALETTES.clair;
    expect(colors).toEqual([accent, 'rgb(255, 255, 255)']);
  });

  test('.visually-hidden retire un titre de l’écran sans le retirer de l’arbre d’accessibilité', async ({
    page,
  }) => {
    await open(page, '/');
    await page.evaluate(() => {
      const heading = document.createElement('h2');
      heading.className = 'visually-hidden';
      heading.textContent = 'Titre masqué';
      document.body.append(heading);
    });

    const heading = page.getByRole('heading', { level: 2, name: 'Titre masqué' });
    await expect(heading).toHaveCount(1);
    const box = await heading.boundingBox();
    expect([box?.width, box?.height]).toEqual([1, 1]);
    expect(await heading.evaluate((element) => getComputedStyle(element).clipPath)).toBe(
      'inset(50%)',
    );
  });
});

test.describe('réglages de lecture', () => {
  test('taille du texte : la racine passe à 115 % puis 130 %, les tailles en rem suivent', async ({
    page,
  }) => {
    await open(page, '/');
    const sizes = async (): Promise<number[]> =>
      page.evaluate(() =>
        [document.documentElement, document.querySelector('h1')].map((element) =>
          parseFloat(getComputedStyle(element ?? document.body).fontSize),
        ),
      );

    // La taille du h1 de la vraie page dépend de la largeur (tokens par palier) : elle se mesure à
    // 100 %, puis se compare à elle-même aux autres tailles.
    await setRoot(page, { 'data-text-size': '100' });
    const [baseRoot = 0, baseHeading = 0] = await sizes();
    expect(baseRoot).toBe(16);
    expect(baseHeading).toBeGreaterThan(0);
    for (const [value, scale] of [
      ['100', 1],
      ['115', 1.15],
      ['130', 1.3],
    ] as const) {
      await setRoot(page, { 'data-text-size': value });
      const [root = 0, heading = 0] = await sizes();
      expect(root).toBeCloseTo(16 * scale, 5);
      expect(heading).toBeCloseTo(baseHeading * scale, 5);
    }
  });

  test('espacement du texte (WCAG 1.4.12) : interligne 1,5, lettres 0,12 em, mots 0,16 em', async ({
    page,
  }) => {
    await open(page, '/');
    const spacing = async (): Promise<{ size: number; values: string[] }> =>
      page
        .locator('main .profile__intro')
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            size: parseFloat(style.fontSize),
            values: [style.letterSpacing, style.wordSpacing],
          };
        });
    /** Interligne, lettres et mots rapportés à la taille du texte du paragraphe. */
    const ratios = async (): Promise<number[]> =>
      page
        .locator('main .profile__intro')
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          const size = parseFloat(style.fontSize);
          return [style.lineHeight, style.letterSpacing, style.wordSpacing].map(
            (value) => Math.round((parseFloat(value) / size) * 1000) / 1000,
          );
        });

    expect((await spacing()).values).toEqual(['normal', '0px']);
    await setRoot(page, { 'data-spacing': 'augmente' });
    expect(await ratios()).toEqual([1.5, 0.12, 0.16]);
    expect((await spacing()).size).toBeGreaterThan(0);
  });

  test('souligner les liens : même un lien sans soulignement le reçoit', async ({ page }) => {
    await open(page, '/');
    await page.evaluate(() => {
      // Lien ordinaire : le seul `a[hreflang]` de la vraie page est le sélecteur de langue, qui a
      // la forme d'un bouton (sans soulignement, D19).
      const plain = document.createElement('a');
      plain.id = 'lien-ordinaire';
      plain.href = '#';
      plain.textContent = 'lien';
      document.body.append(plain);
      const link = document.createElement('a');
      link.id = 'sans-soulignement';
      link.href = '#';
      link.style.textDecoration = 'none';
      link.textContent = 'lien';
      document.body.append(link);
    });
    const decoration = async (selector: string): Promise<string> =>
      page.locator(selector).evaluate((element) => getComputedStyle(element).textDecorationLine);

    expect(await decoration('#lien-ordinaire')).toBe('underline');
    expect(await decoration('#sans-soulignement')).toBe('none');
    await setRoot(page, { 'data-links': 'soulignes' });
    expect(await decoration('#sans-soulignement')).toBe('underline');
  });
});

test.describe('polices auto-hébergées', () => {
  test('servies par le site, Atkinson Hyperlegible et JetBrains Mono téléchargées seulement à l’usage', async ({
    page,
    baseURL,
  }) => {
    const requests: string[] = [];
    const failures: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    const fonts = (family: string): string[] =>
      requests.filter((url) => url.includes(`/fonts/${family}/`));
    const loaded = async (family: string): Promise<string[]> =>
      page.evaluate(
        (name) =>
          [...document.fonts]
            .filter((face) => face.family.replace(/["']/g, '') === name)
            .map((face) => face.status),
        family,
      );

    await open(page, '/');
    await page.evaluate(async () => document.fonts.ready);

    expect(fonts('space-grotesk')).toEqual([
      `${baseURL}/fonts/space-grotesk/space-grotesk-latin-wght-normal.woff2`,
    ]);
    expect(await loaded('Space Grotesk')).toContain('loaded');
    expect(fonts('atkinson-hyperlegible')).toEqual([]);
    // JetBrains Mono sert dès le chargement (nom de fichier des barres de fenêtre) : une seule
    // requête, déjà chargée ; Atkinson Hyperlegible attend d'être demandée.
    expect(fonts('jetbrains-mono')).toEqual([
      `${baseURL}/fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2`,
    ]);
    expect(await loaded('JetBrains Mono')).toContain('loaded');
    expect(await loaded('Atkinson Hyperlegible')).toEqual(Array(8).fill('unloaded'));

    await setRoot(page, { 'data-font': 'lisible' });
    await expect
      .poll(() => fonts('atkinson-hyperlegible'))
      .toContain(
        `${baseURL}/fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-400-normal.woff2`,
      );
    await page.evaluate(async () => document.fonts.ready);
    expect(await loaded('Atkinson Hyperlegible')).toContain('loaded');
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(
      /^"?Atkinson Hyperlegible"?,/,
    );

    await page.evaluate(async () => document.fonts.load('1rem "JetBrains Mono"'));
    expect(fonts('jetbrains-mono')).toEqual([
      `${baseURL}/fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2`,
    ]);
    expect(await loaded('JetBrains Mono')).toContain('loaded');

    const origin = new URL(baseURL ?? '').origin;
    expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
    expect(failures).toEqual([]);
  });
});

test.describe('mouvement', () => {
  /** Durée calculée d'une transition de 2 s posée sur un élément de test. */
  async function transition(page: Page): Promise<number> {
    const value = await page.evaluate(() => {
      const element = document.createElement('div');
      element.style.transition = 'opacity 2s ease';
      document.body.append(element);
      const duration = getComputedStyle(element).transitionDuration;
      element.remove();
      return duration;
    });
    return milliseconds(value);
  }

  test.describe('système sans préférence', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('durées du handoff, réduites par data-motion="reduit"', async ({ page }) => {
      await open(page, '/');
      expect(milliseconds(await rootVariable(page, '--dur-tile'))).toBeCloseTo(550, 5);
      expect(milliseconds(await rootVariable(page, '--dur-accordion'))).toBeCloseTo(320, 5);
      expect(await transition(page)).toBe(2000);

      await setRoot(page, { 'data-motion': 'reduit' });
      expect(milliseconds(await rootVariable(page, '--dur-tile'))).toBeCloseTo(0.01, 5);
      expect(await transition(page)).toBeCloseTo(0.01, 5);
    });
  });

  test.describe('système en mouvement réduit', () => {
    test.use({ reducedMotion: 'reduce' });

    test('durées réduites par défaut, rétablies par data-motion="normal"', async ({ page }) => {
      await open(page, '/');
      expect(milliseconds(await rootVariable(page, '--dur-tile'))).toBeCloseTo(0.01, 5);
      expect(milliseconds(await rootVariable(page, '--dur-press'))).toBeCloseTo(0.01, 5);
      expect(await transition(page)).toBeCloseTo(0.01, 5);

      await setRoot(page, { 'data-motion': 'normal' });
      expect(milliseconds(await rootVariable(page, '--dur-tile'))).toBeCloseTo(550, 5);
      expect(await transition(page)).toBe(2000);
    });
  });
});
