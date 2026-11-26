import { expect, test } from '@playwright/test';

import {
  expectAxeClean,
  expectShellMounted,
  gotoMounted,
  PALETTES,
  STORAGE_KEY,
  storePreferences,
  tabsMode,
} from './support/e2e.js';

// Parcours de la vraie page (lot F3a : coquille et données sur les fixtures), à chaque taille d'écran
// des maquettes (un projet Playwright par taille), en français et en anglais :
// - axe WCAG 2.2 AA dans les quatre palettes, sur chaque section (onglets du mobile et de la
//   tablette, sections ensemble sur le bureau) ;
// - lien d'évitement ; navigation par sections au clavier (onglets du bas et `aria-current` sous
//   1024 px, barre du haut au-delà) ; panneau d'accessibilité au clavier (D18) ;
// - thème et réglages enregistrés puis rechargés sans flash (D5) ;
// - sélecteur de langue (D21).
// Le mode se déduit de la largeur du projet : chaque test vérifie le comportement de la sienne.

const LOCALES = {
  fr: {
    path: '/',
    heading: 'Développeur full-stack',
    sections: ['Profil', 'Expérience', 'Recommandations', 'IA'],
    tabs: ['Profil', 'XP', 'Recos', 'IA'],
    files: ['profil.cv', 'experience.log', 'recommandations.md', 'ia.md'],
    skip: 'Aller au contenu',
    panelTrigger: 'Options d’accessibilité',
    panelName: 'Réglages d’accessibilité',
    firstSetting: 'Taille de texte normale',
    contrast: 'Contraste renforcé',
    language: { current: 'FR', link: 'EN', target: 'en', targetPath: '/en' },
    toLight: 'Thème sombre, passer en thème clair',
  },
  en: {
    path: '/en',
    heading: 'Full-stack developer',
    sections: ['Profile', 'Experience', 'Recommendations', 'AI'],
    tabs: ['Profile', 'XP', 'Recs', 'AI'],
    files: ['profil.cv', 'experience.log', 'recommandations.md', 'ia.md'],
    skip: 'Skip to content',
    panelTrigger: 'Accessibility options',
    panelName: 'Accessibility settings',
    firstSetting: 'Normal text size',
    contrast: 'Enhanced contrast',
    language: { current: 'EN', link: 'FR', target: 'fr', targetPath: '/' },
    toLight: 'Dark theme, switch to light theme',
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} (${locale.path})`, () => {
    test('structure : un en-tête, un main, un h1, un h2 par section, lang', async ({ page }) => {
      await gotoMounted(page, locale.path);

      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale.heading);
      const headings = page.locator('main section h2');
      await expect(headings).toHaveText([...locale.sections]);
      if (tabsMode(page)) {
        // Mobile et tablette : en-tête mobile, barre d'actions et navigation du bas ; h2 masqués.
        await expect(page.locator('.top-bar')).toHaveCount(0);
        await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
        await expect(page.locator('.action-bar')).toBeVisible();
        const box = await page.locator('#titre-profile').boundingBox();
        expect([box?.width, box?.height]).toEqual([1, 1]);
        await expect(page.locator('main section:visible')).toHaveCount(1);
      } else {
        await expect(page.locator('.mobile-header, .bottom-nav, .action-bar')).toHaveCount(0);
        await expect(page.locator('.top-bar')).toBeVisible();
        await expect(page.locator('main section:visible')).toHaveCount(4);
        await expect(page.locator('#titre-profile')).toBeVisible();
      }
    });

    for (const palette of PALETTES) {
      test(`axe WCAG 2.2 AA, palette ${palette.name}, chaque section`, async ({ page }) => {
        await storePreferences(page, { theme: palette.theme, highContrast: palette.highContrast });
        await gotoMounted(page, locale.path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', palette.theme);

        if (!tabsMode(page)) {
          await expectAxeClean(page, palette.name);
          return;
        }
        for (const [index, tab] of locale.tabs.entries()) {
          await page
            .getByRole('navigation', { name: 'Sections' })
            .getByRole('button')
            .nth(index)
            .click();
          await expect(
            page.getByRole('heading', { level: 2, name: locale.sections[index] ?? '' }),
          ).toHaveCount(1);
          await expectAxeClean(page, `${palette.name}, onglet ${tab}`);
        }
      });
    }

    test('lien d’évitement : premier arrêt du clavier, visible, mène au contenu', async ({
      page,
    }) => {
      await gotoMounted(page, locale.path);

      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: locale.skip });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Enter');

      await expect(page.locator('main#contenu')).toBeFocused();
      await expect(page).toHaveURL(/#contenu$/);
    });

    test('sections au clavier : onglets (aria-current) ou barre du haut', async ({ page }) => {
      await gotoMounted(page, locale.path);

      if (tabsMode(page)) {
        const nav = page.getByRole('navigation', { name: 'Sections' });
        const tabs = nav.getByRole('button');
        await expect(tabs).toHaveText([...locale.tabs]);
        await expect(tabs.nth(0)).toHaveAttribute('aria-current', 'true');

        await tabs.nth(1).focus();
        await page.keyboard.press('Enter');
        await expect(tabs.nth(1)).toHaveAttribute('aria-current', 'true');
        await expect(tabs.nth(0)).not.toHaveAttribute('aria-current');
        await expect(page.locator('#section-experience')).toBeVisible();
        await expect(page.locator('#section-profile')).toBeHidden();
        await expect(page.locator('.mobile-header')).toContainText(locale.files[1]);

        await tabs.nth(3).focus();
        await page.keyboard.press('Space');
        await expect(tabs.nth(3)).toHaveAttribute('aria-current', 'true');
        await expect(page.locator('#section-ai')).toBeVisible();
        await expect(page.locator('.mobile-header')).toContainText(locale.files[3]);
        // h1 toujours présent pour les lecteurs d'écran, masqué visuellement hors du Profil.
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale.heading);
      } else {
        const tabs = page.locator('.top-bar__nav button');
        await expect(tabs.nth(0)).toHaveAttribute('aria-current', 'true');
        await tabs.nth(2).focus();
        await page.keyboard.press('Enter');
        await expect(tabs.nth(2)).toHaveAttribute('aria-current', 'true');
        await expect(page.locator('#section-experience')).toBeFocused();
      }
    });

    test('panneau d’accessibilité au clavier : nom, focus, Échap', async ({ page }) => {
      await gotoMounted(page, locale.path);
      const trigger = page.getByRole('button', { name: locale.panelTrigger, exact: true });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.focus();
      await page.keyboard.press('Enter');

      const panel = page.getByRole('dialog', { name: locale.panelName });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading', { level: 2 })).toHaveText('accessibilite.cfg');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('button', { name: locale.firstSetting })).toBeFocused();
      await expectAxeClean(page, 'panneau ouvert');

      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test('thème et réglages enregistrés, rechargés sans flash', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await gotoMounted(page, locale.path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');

      await page.getByRole('button', { name: locale.toLight }).click();
      await page.getByRole('button', { name: locale.panelTrigger, exact: true }).click();
      await page.getByRole('switch', { name: locale.contrast }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'clair');
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'renforce');
      const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      expect(JSON.parse(stored ?? 'null')).toMatchObject({
        version: 1,
        theme: 'clair',
        highContrast: true,
      });

      // Rechargement : chaque changement d'attribut de <html> est noté, avec l'existence de <body>.
      await page.addInitScript(() => {
        const log: { name: string; value: string | null; beforeBody: boolean }[] = [];
        Object.assign(window, { __rootMutations: log });
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
      await page.reload();
      await expectShellMounted(page);

      const log = await page.evaluate(
        () =>
          (
            window as unknown as {
              __rootMutations: { name: string; value: string | null; beforeBody: boolean }[];
            }
          ).__rootMutations,
      );
      for (const [name, value] of [
        ['data-theme', 'clair'],
        ['data-contrast', 'renforce'],
      ] as const) {
        const changes = log.filter((entry) => entry.name === name);
        expect(changes[0], name).toEqual({ name, value, beforeBody: true });
        expect(new Set(changes.map((entry) => entry.value)), name).toEqual(new Set([value]));
      }
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      ).toBe('rgb(255, 255, 255)');
    });

    test('sélecteur de langue : « FR | EN », langue courante sans lien, nom = texte visible (D21)', async ({
      page,
    }) => {
      await gotoMounted(page, locale.path);

      const switcher = page.locator('.language-switch');
      await expect(switcher).toHaveCount(1);
      await expect(switcher).toContainText(/^FR\s*\|\s*EN$/);
      // Langue courante : un texte, pas un lien, avec le lang de la page.
      const current = switcher.locator('[aria-current="true"]');
      await expect(current).toHaveText(locale.language.current);
      await expect(current).toHaveAttribute('lang', code);
      await expect(switcher.getByRole('link')).toHaveCount(1);
      // Autre langue : le nom accessible est exactement le texte visible, sans aria-label.
      const link = page.getByRole('link', { name: locale.language.link, exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText(locale.language.link);
      await expect(link).not.toHaveAttribute('aria-label');
      await expect(link).toHaveAttribute('hreflang', locale.language.target);
      await expect(link).toHaveAttribute('lang', locale.language.target);
      await expect(switcher.locator('[aria-hidden="true"]')).toHaveText('|');
      // Cible d'au moins 44 px sous 1024 px (D21), 24 px au-delà (WCAG 2.5.8).
      const box = await link.boundingBox();
      const minimum = tabsMode(page) ? 44 : 24;
      expect(box?.width).toBeGreaterThanOrEqual(minimum);
      expect(box?.height).toBeGreaterThanOrEqual(minimum);
      // Focus visible au clavier.
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      const outline = await link.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.outlineStyle, style.outlineWidth];
      });
      expect(outline).toEqual(['solid', '2px']);

      await link.click();
      await expect(page).toHaveURL(new RegExp(`${locale.language.targetPath}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', locale.language.target);
    });
  });
}

test('/fr renvoie vers la page française sans préfixe (D15)', async ({ page, baseURL }) => {
  await page.goto('/fr');

  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(LOCALES.fr.heading);
});
