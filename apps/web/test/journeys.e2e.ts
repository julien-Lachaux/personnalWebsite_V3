import { expect, test, type Page } from '@playwright/test';

// Parcours de bout en bout du lot F8 (SPEC § 12), qui complètent les parcours par section sans les
// répéter (le clavier du filtre, de l'easter egg et du panneau, le CV PDF et les pages 404 ont les leurs
// dans experience, shell, cv et pages) :
// - filtre : une URL `?tech=` à plusieurs technos, bâtie par des clics, s'ouvre telle quelle chez
//   quelqu'un d'autre (stockage vide) et survit au changement de langue ;
// - agrandir puis réduire une tuile à la souris (mosaïque), l'URL et le filtre restant intacts ;
// - onglets du bas à la souris (sous 1024 px) : un seul onglet courant, une seule section visible ;
// - réglages d'accessibilité posés à la souris, enregistrés, appliqués après rechargement, puis remis à zéro.
// Le mode se déduit de la largeur du projet : chaque test vérifie le comportement de la sienne.

const STORAGE_KEY = 'siteperso:preferences';

const LOCALES = {
  fr: {
    path: '/',
    nav: 'Sections',
    tabs: ['Profil', 'XP', 'Recos', 'IA'],
    sections: ['profile', 'experience', 'recommendations', 'ai'],
    expand: /^Agrandir /,
    collapse: /^Réduire /,
    remove: (name: string) => `Retirer le filtre ${name}`,
    filterBy: (name: string) => `Filtrer par ${name}`,
    panelTrigger: 'Options d’accessibilité',
    panelName: 'Réglages d’accessibilité',
    larger: 'Très grande taille de texte',
    switches: [
      'Contraste renforcé',
      'Police plus lisible',
      'Espacement du texte',
      'Souligner les liens',
      'Réduire les animations',
    ],
    reset: 'Réinitialiser',
    otherLanguage: 'EN',
  },
  en: {
    path: '/en',
    nav: 'Sections',
    tabs: ['Profile', 'XP', 'Recs', 'AI'],
    sections: ['profile', 'experience', 'recommendations', 'ai'],
    expand: /^Expand /,
    collapse: /^Collapse /,
    remove: (name: string) => `Remove filter ${name}`,
    filterBy: (name: string) => `Filter by ${name}`,
    panelTrigger: 'Accessibility options',
    panelName: 'Accessibility settings',
    larger: 'Largest text size',
    switches: [
      'Enhanced contrast',
      'More readable font',
      'Text spacing',
      'Underline links',
      'Reduce animations',
    ],
    reset: 'Reset',
    otherLanguage: 'FR',
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

function tabsMode(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

/** Page chargée et hydratée (la coquille a choisi son mode). */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
}

/** Section Expérience visible (onglet XP choisi sous 1024 px). */
async function openExperience(page: Page, code: LocaleCode, path: string) {
  const locale = LOCALES[code];
  await open(page, path);
  if (tabsMode(page)) {
    await page
      .getByRole('navigation', { name: locale.nav })
      .getByRole('button', { name: locale.tabs[1], exact: true })
      .click();
  }
  const section = page.locator('#section-experience');
  await expect(section).toBeVisible();
  return section;
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} (${locale.path})`, () => {
    test('filtre partagé : une URL à deux technos bâtie par des clics s’ouvre à l’identique, langue changée comprise', async ({
      page,
    }) => {
      const section = await openExperience(page, code, locale.path);
      for (const tech of ['Apache Kafka', 'Docker']) {
        await section
          .getByRole('button', { name: locale.filterBy(tech), exact: true })
          .first()
          .click();
      }
      await expect(page).toHaveURL(/\?tech=[a-z-]+,[a-z-]+$/);
      const shared = page.url();
      const chips = await section
        .getByRole('button', { name: /^(Retirer le filtre|Remove filter) / })
        .allTextContents();
      const results = await section.getByRole('article').count();
      expect(chips).toHaveLength(2);

      // Chez quelqu'un d'autre : stockage vide, même URL.
      await page.evaluate(() => localStorage.clear());
      await page.goto(shared);
      await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
      const reopened = await openExperience(page, code, shared);
      await expect(
        reopened.getByRole('button', { name: /^(Retirer le filtre|Remove filter) / }),
      ).toHaveText(chips);
      await expect(reopened.getByRole('article')).toHaveCount(results);

      // Changement de langue : mêmes technos, mêmes résultats.
      const other = locale.otherLanguage;
      const href = new URL(shared);
      const query = href.search;
      await page.getByRole('link', { name: other, exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`${code === 'fr' ? '/en' : '/'}${query.replace('?', '\\?')}$`),
      );
      const translated = await openExperience(page, code === 'fr' ? 'en' : 'fr', page.url());
      await expect(
        translated.getByRole('button', { name: /^(Retirer le filtre|Remove filter) / }),
      ).toHaveCount(2);
      await expect(translated.getByRole('article')).toHaveCount(results);
    });

    test('tuiles : agrandir puis réduire à la souris, URL et filtre intacts', async ({ page }) => {
      await open(page, `${locale.path}?tech=kafka`);
      if (tabsMode(page)) {
        await expect(page.locator('.tile-grid')).toHaveCount(0);
        return;
      }
      await expect(page.locator('.tile-grid:not(.tile-grid--instant)')).toHaveCount(1);

      for (const id of locale.sections) {
        const tile = page.locator(`[data-tile="${id}"]`);
        await tile.getByRole('button', { name: locale.expand }).click();
        await expect(tile).toHaveClass(/tile-grid__tile--expanded/);
        await expect(tile.getByRole('button', { name: locale.collapse })).toBeVisible();
        await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(1);

        await tile.getByRole('button', { name: locale.collapse }).click();
        await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(0);
        await expect(tile.getByRole('button', { name: locale.expand })).toBeVisible();
      }
      await expect(page).toHaveURL(/\?tech=kafka$/);
      await expect(
        page
          .locator('#section-experience')
          .getByRole('button', { name: locale.remove('Apache Kafka') }),
      ).toBeVisible();
    });

    test('onglets du bas à la souris : un onglet courant, une section visible, filtre conservé', async ({
      page,
    }) => {
      await open(page, `${locale.path}?tech=kafka`);
      if (!tabsMode(page)) {
        await expect(page.locator('.bottom-nav')).toHaveCount(0);
        return;
      }
      const nav = page.getByRole('navigation', { name: locale.nav });
      for (const [index, name] of locale.tabs.entries()) {
        await nav.getByRole('button', { name, exact: true }).click();
        await expect(nav.getByRole('button', { name, exact: true })).toHaveAttribute(
          'aria-current',
          'true',
        );
        await expect(nav.locator('[aria-current="true"]')).toHaveCount(1);
        for (const [other, id] of locale.sections.entries()) {
          const section = page.locator(`#section-${id}`);
          if (other === index) await expect(section).toBeVisible();
          else await expect(section).toBeHidden();
        }
        await expect(page).toHaveURL(/\?tech=kafka$/);
      }
    });

    test('réglages posés à la souris : enregistrés, appliqués après rechargement, remis à zéro', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
      await open(page, locale.path);
      const html = page.locator('html');

      await page.getByRole('button', { name: locale.panelTrigger, exact: true }).click();
      const panel = page.getByRole('dialog', { name: locale.panelName });
      await expect(panel).toBeVisible();
      await panel.getByRole('button', { name: locale.larger }).click();
      for (const name of locale.switches) await panel.getByRole('switch', { name }).click();

      const expected = {
        'data-text-size': '130',
        'data-contrast': 'renforce',
        'data-font': 'lisible',
        'data-spacing': 'augmente',
        'data-links': 'soulignes',
        'data-motion': 'reduit',
      };
      for (const [name, value] of Object.entries(expected)) {
        await expect(html, name).toHaveAttribute(name, value);
      }
      const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      expect(JSON.parse(stored ?? 'null')).toMatchObject({
        version: 1,
        textSize: 130,
        highContrast: true,
        readableFont: true,
        textSpacing: true,
        underlineLinks: true,
        reduceMotion: true,
      });

      await page.reload();
      await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
      for (const [name, value] of Object.entries(expected)) {
        await expect(html, `${name} après rechargement`).toHaveAttribute(name, value);
      }
      await page.getByRole('button', { name: locale.panelTrigger, exact: true }).click();
      const reopened = page.getByRole('dialog', { name: locale.panelName });
      await expect(reopened.getByRole('button', { name: locale.larger })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      for (const name of locale.switches) {
        await expect(reopened.getByRole('switch', { name })).toBeChecked();
      }

      await reopened.getByRole('button', { name: locale.reset, exact: true }).click();
      expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
      await expect(html).not.toHaveAttribute('data-text-size', '130');
      await expect(html).not.toHaveAttribute('data-contrast', 'renforce');
      await expect(html).not.toHaveAttribute('data-font', 'lisible');
      await expect(html).not.toHaveAttribute('data-spacing', 'augmente');
      await expect(html).not.toHaveAttribute('data-links', 'soulignes');
    });
  });
}
