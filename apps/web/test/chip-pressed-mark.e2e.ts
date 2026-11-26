import { expect, test, type Locator, type Page } from '@playwright/test';

import { gotoMounted, PALETTES, storePreferences } from './support/e2e.js';

// Coche de la puce pressée (D35, RA-7, WCAG 1.4.1) : une puce `aria-pressed="true"` porte une coche ✓
// décorative devant son nom, dans les quatre palettes ; une puce non pressée n'en porte pas. Le nom
// accessible et le texte de la puce ne changent pas (la coche est un pseudo-élément à contenu
// alternatif vide). La coche est lue sur le rendu (`::before`), et sa couleur est celle de la puce.

const LOCALES = {
  fr: { path: '/', tabs: 'Sections', xp: 'XP', name: /^Docker, \d+ expériences?$/ },
  en: { path: '/en', tabs: 'Sections', xp: 'XP', name: /^Docker, \d+ experiences?$/ },
} as const;

/** Contenu rendu du `::before` de la puce ('none' ou 'normal' : aucun) et sa couleur. */
async function mark(chip: Locator): Promise<{ content: string; color: string; chipColor: string }> {
  return chip.evaluate((element) => {
    const before = getComputedStyle(element, '::before');
    return {
      content: before.content,
      color: before.color,
      chipColor: getComputedStyle(element).color,
    };
  });
}

async function openFilter(page: Page, code: keyof typeof LOCALES): Promise<Locator> {
  await page.goto(LOCALES[code].path);
  await expect(page.locator('.app-shell[data-mode="tabs"]')).toHaveCount(1);
  await page
    .getByRole('navigation', { name: LOCALES[code].tabs })
    .getByRole('button', { name: LOCALES[code].xp, exact: true })
    .click();
  const section = page.locator('#section-experience');
  await section.getByRole('textbox').click();
  const quick = section.locator('.filter-drawer__quick');
  await expect(quick).toBeVisible();
  return quick;
}

test.describe('390 px, coche des puces pressées', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    for (const palette of PALETTES) {
      test(`${code}, ${palette.name} : la coche apparaît quand la puce est pressée, sans changer son nom`, async ({
        page,
      }) => {
        await storePreferences(page, {
          theme: palette.theme,
          highContrast: palette.highContrast,
        });
        const quick = await openFilter(page, code);

        const docker = quick.getByRole('button', { name: /^Docker/ });
        const text = await docker.innerText();
        await expect(docker).toHaveAttribute('aria-pressed', 'false');
        expect((await mark(docker)).content, 'puce non pressée').toMatch(/^(none|normal)$/);

        await docker.click();
        await expect(docker).toHaveAttribute('aria-pressed', 'true');
        await page.mouse.move(0, 0);

        const pressed = await mark(docker);
        expect(pressed.content, 'puce pressée').toContain('✓');
        expect(pressed.color, 'couleur de la puce').toBe(pressed.chipColor);
        // Le texte et le nom accessible ne changent pas : la coche est décorative.
        await expect(docker).toHaveText(text);
        await expect(docker).toHaveAttribute('aria-label', LOCALES[code].name);

        // Seule la puce pressée porte la coche : une autre puce reste sans.
        const typescript = quick.getByRole('button', { name: /^TypeScript/ });
        expect((await mark(typescript)).content, 'autre puce').toMatch(/^(none|normal)$/);
      });
    }
  }
});

test.describe('1280 px, coche des puces d’une carte', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('la puce pressée d’une carte porte la coche, la puce non pressée n’en porte pas', async ({
    page,
  }) => {
    await gotoMounted(page, '/');
    const section = page.locator('#section-experience');
    const idle = section.locator('article button.tech-chip[aria-pressed="false"]').first();
    await expect(idle).toBeVisible();
    expect((await mark(idle)).content).toMatch(/^(none|normal)$/);

    await idle.click();
    const pressed = section.locator('article button.tech-chip[aria-pressed="true"]').first();
    await expect(pressed).toBeVisible();
    expect((await mark(pressed)).content).toContain('✓');
  });
});
