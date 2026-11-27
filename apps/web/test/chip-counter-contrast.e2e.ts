import { expect, test, type Locator } from '@playwright/test';

import { PALETTES, storePreferences, waitForSettledAnimations } from './support/e2e.js';

// Contraste du compteur des puces de techno (constat RA-6, WCAG 1.4.3) : le compteur gardait une opacité de
// 0,75 qui, sur une puce active (ou survolée), le ramenait à 3,8:1 en thème clair. Mesure sur les couleurs
// rendues (couleur du texte, opacité, fonds composés), dans les quatre palettes, puce active puis survolée :
// au moins 4,5:1.

const LOCALES = {
  fr: { path: '/', tabs: 'Sections', xp: 'XP', filter: 'filtrer par techno' },
  en: { path: '/en', tabs: 'Sections', xp: 'XP', filter: 'filter by tech' },
} as const;

/** Contraste WCAG du texte de `counter` sur les fonds rendus derrière lui, opacité comprise. */
async function counterContrast(counter: Locator): Promise<number> {
  return counter.evaluate((element) => {
    type Rgba = [number, number, number, number];

    function parse(value: string): Rgba {
      const numbers = value.match(/-?[\d.]+%?/g)!.map((part) => parseFloat(part));
      if (value.startsWith('color(srgb')) {
        const [r, g, b, a = 1] = numbers.slice(0);
        return [r! * 255, g! * 255, b! * 255, a];
      }
      const [r, g, b, a = 1] = numbers;
      return [r!, g!, b!, a];
    }

    function over(top: Rgba, bottom: Rgba): Rgba {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const mix = (index: 0 | 1 | 2): number =>
        (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha;
      return [mix(0), mix(1), mix(2), alpha];
    }

    function luminance([r, g, b]: Rgba): number {
      const channel = (value: number): number => {
        const unit = value / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }

    // Fond : les fonds translucides des ancêtres, composés de proche en proche jusqu'à un fond opaque.
    let background: Rgba = [255, 255, 255, 0];
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      background = over(background, parse(getComputedStyle(node).backgroundColor));
      if (background[3] >= 1) break;
    }
    const style = getComputedStyle(element);
    const color = parse(style.color);
    // Opacité de l'élément et de ses ancêtres (la puce désactivée est à 0,45).
    let opacity = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      opacity *= parseFloat(getComputedStyle(node).opacity);
    }
    const text = over([color[0], color[1], color[2], color[3] * opacity], background);
    const [light, dark] = [luminance(text), luminance(background)].sort((a, b) => b - a);
    return (light! + 0.05) / (dark! + 0.05);
  });
}

test.describe('390 px, compteur des puces', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    for (const palette of PALETTES) {
      test(`${code}, ${palette.name} : compteur d’une puce active ou survolée, au moins 4,5:1`, async ({
        page,
      }) => {
        const locale = LOCALES[code];
        await storePreferences(page, {
          theme: palette.theme,
          highContrast: palette.highContrast,
        });
        await page.goto(locale.path);
        await expect(page.locator('.app-shell[data-mode="tabs"]')).toHaveCount(1);
        await page
          .getByRole('navigation', { name: locale.tabs })
          .getByRole('button', { name: locale.xp, exact: true })
          .click();
        const section = page.locator('#section-experience');
        await section.getByRole('textbox').click();
        const quick = section.locator('.filter-drawer__quick');
        await expect(quick).toBeVisible();

        const docker = quick.getByRole('button', { name: /^Docker/ });
        await docker.click();
        await expect(docker).toHaveAttribute('aria-pressed', 'true');
        // Pointeur ailleurs : la puce est active sans être survolée.
        await page.mouse.move(0, 0);
        await waitForSettledAnimations(page);
        expect(
          await counterContrast(docker.locator('.tech-option__count')),
          'puce active',
        ).toBeGreaterThanOrEqual(4.5);

        const typescript = quick.getByRole('button', { name: /^TypeScript/ });
        await typescript.hover();
        await waitForSettledAnimations(page);
        expect(
          await counterContrast(typescript.locator('.tech-option__count')),
          'puce survolée',
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
