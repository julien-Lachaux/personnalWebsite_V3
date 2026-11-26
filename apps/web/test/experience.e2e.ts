import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  expectAxeClean,
  expectShellMounted,
  gotoMounted,
  PALETTES,
  storePreferences,
  tabsMode,
  waitForSettledAnimations,
} from './support/e2e.js';

// Parcours de la section Expérience (lot F5b, filtre par techno, cartes, easter egg) sur la vraie page,
// à chaque taille d'écran des maquettes, en français et en anglais, sur les fixtures :
// - filtre dans l'URL (`?tech=`) : lecture au chargement, écriture au clic, partageable, conservé quand
//   on change d'onglet ;
// - clavier du filtre : le panneau s'ouvre au focus, la saisie remplace le panneau par les suggestions,
//   Entrée choisit la première suggestion valide, Retour arrière retire la dernière puce, Échap ferme ;
// - panneau : « Toutes les technos », techno à 0 résultat désactivée, technos sans expérience en
//   pointillé, Fermer rend le focus au champ sans rouvrir le panneau ;
// - résultats : « Avec toutes ces technos · N », autres expériences atténuées « En partie : X », état vide ;
// - cartes : accordéon (`aria-expanded`, 320 ms, immédiat sous mouvement réduit), puces qui filtrent ;
// - easter egg : fenêtre modale nommée, lignes animées une à une (toutes affichées d'emblée sous mouvement
//   réduit), Échap, retour du focus sur la puce ;
// - zone du filtre fixe pendant que la liste défile, cibles de 44 px sous 1024 px, axe WCAG 2.2 AA dans
//   les quatre palettes (états : repos, panneau déplié, résultats, fenêtre ouverte).
// Sous 1024 px, la section est celle de l'onglet XP ; au-delà, elle est dans la page avec les autres.

const LOCALES = {
  fr: {
    path: '/',
    label: 'filtrer par techno',
    list: 'Liste des expériences',
    remove: (name: string) => `Retirer le filtre ${name}`,
    clearAll: 'Effacer tous les filtres',
    allTechs: 'Toutes les technos (34)',
    hideAll: 'Masquer la liste',
    mainStack: 'stack principale',
    close: 'Fermer',
    withAll: 'Avec toutes ces technos · 2',
    showOthers: 'Voir les 6 autres expériences',
    hideOthers: 'Masquer les 6 autres expériences',
    othersTitle: 'Les autres expériences · 6',
    partial: 'En partie : Docker',
    empty: 'Aucune expérience ne combine toutes ces technos',
    showAll: 'Voir les 8 expériences',
    live: '2 expériences avec toutes les technos choisies',
    detail: 'Détail : Senior Software Engineer chez Nopillo',
    filterBy: (name: string) => `Filtrer par ${name}`,
    kafka: 'Apache Kafka',
    egg: {
      chip: 'Huile de coude',
      back: 'Retour au CV',
      done: 'Terminé. 0 vulnérabilité (sauf le dos).',
    },
    tabs: 'Sections',
    xpTab: 'XP',
    profileTab: 'Profil',
  },
  en: {
    path: '/en',
    label: 'filter by tech',
    list: 'List of experiences',
    remove: (name: string) => `Remove filter ${name}`,
    clearAll: 'Clear all filters',
    allTechs: 'All techs (34)',
    hideAll: 'Hide the list',
    mainStack: 'main stack',
    close: 'Close',
    withAll: 'With all these techs · 2',
    showOthers: 'Show the 6 other experiences',
    hideOthers: 'Hide the 6 other experiences',
    othersTitle: 'The other experiences · 6',
    partial: 'Partly: Docker',
    empty: 'No experience combines all these techs',
    showAll: 'Show the 8 experiences',
    live: '2 experiences with all the chosen techs',
    detail: 'Details: Senior Software Engineer at Nopillo',
    filterBy: (name: string) => `Filter by ${name}`,
    kafka: 'Apache Kafka',
    egg: {
      chip: 'Elbow grease',
      back: 'Back to the CV',
      done: 'Done. 0 vulnerabilities (except the back).',
    },
    tabs: 'Sections',
    xpTab: 'XP',
    profileTab: 'Profile',
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

/** Page chargée, hydratée, sur la section Expérience (onglet XP sous 1024 px) : renvoie la section. */
async function openExperience(page: Page, code: LocaleCode, query = ''): Promise<Locator> {
  const locale = LOCALES[code];
  await gotoMounted(page, `${locale.path}${query}`);
  if (tabsMode(page)) {
    await page
      .getByRole('navigation', { name: locale.tabs })
      .getByRole('button', { name: locale.xpTab, exact: true })
      .click();
  }
  const section = page.locator('#section-experience');
  await expect(section.getByText(locale.label, { exact: true })).toBeVisible();
  // Le filtre lit l'URL après le montage : attendre que les puces de l'URL soient là.
  return section;
}

function field(section: Locator): Locator {
  return section.getByRole('textbox');
}

function drawer(section: Locator): Locator {
  return section.locator('.filter-drawer');
}

/** Vrai quand le panneau est ouvert (classe posée, donc visible et atteignable). */
async function drawerOpen(section: Locator): Promise<boolean> {
  return (await drawer(section).getAttribute('class'))?.includes('filter-drawer--open') ?? false;
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} (${locale.path})`, () => {
    test('structure : filtre dans une zone fixe, liste nommée et atteignable au clavier', async ({
      page,
    }) => {
      const section = await openExperience(page, code);

      const search = section.getByRole('search');
      await expect(search).toBeVisible();
      await expect(field(section)).toHaveAccessibleName(locale.label);
      const list = section.getByRole('region', { name: locale.list });
      await expect(list).toHaveAttribute('tabindex', '0');
      await expect(list.getByRole('article')).toHaveCount(8);
      await expect(section.getByRole('heading', { level: 3 }).first()).toBeVisible();
      // Zone fixe : le filtre n'est pas dans la liste et ne bouge pas quand elle défile. La mesure de
      // départ attend la fin du glissement de l'onglet (340 ms sous 1024 px, coquille F3a).
      await expect(list.getByRole('search')).toHaveCount(0);
      await waitForSettledAnimations(page, section);
      const before = await search.boundingBox();
      await list.evaluate((element) => {
        element.scrollTop = 400;
      });
      await expect
        .poll(async () => list.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      expect(await search.boundingBox()).toEqual(before);
    });

    test('filtre dans l’URL : lu au chargement, annoncé, avec les technos inconnues ignorées', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=kafka,inconnue');

      await expect(
        section.getByRole('button', { name: locale.remove(locale.kafka) }),
      ).toBeVisible();
      await expect(section.locator('.result-groups__title').first()).toHaveText(
        `${code === 'fr' ? 'Avec' : 'With'} ${locale.kafka} · 2`,
      );
      await expect(section.getByRole('article')).toHaveCount(2);
      await expect(section.locator('[aria-live="polite"]')).toHaveText(
        code === 'fr'
          ? '2 expériences avec toutes les technos choisies'
          : '2 experiences with all the chosen techs',
      );
    });

    test('clavier : le focus ouvre le panneau, Entrée choisit, Retour arrière retire, Échap ferme', async ({
      page,
    }) => {
      const section = await openExperience(page, code);
      await section.focus();

      await page.keyboard.press('Tab');
      await expect(field(section)).toBeFocused();
      expect(await drawerOpen(section)).toBe(true);
      await expect(section.getByText(locale.mainStack, { exact: true })).toBeVisible();

      await page.keyboard.type('kafka');
      const suggestions = section.getByRole('group', {
        name: code === 'fr' ? 'Suggestions de technos' : 'Tech suggestions',
      });
      await expect(suggestions.getByRole('button')).toHaveCount(1);
      await expect(suggestions.getByRole('button')).toContainText(locale.kafka);
      await expect(section.locator('.filter-drawer')).toHaveAttribute('inert', '');

      await page.keyboard.press('Enter');
      await expect(
        section.getByRole('button', { name: locale.remove(locale.kafka) }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\?tech=kafka$/);
      await expect(field(section)).toBeFocused();
      await expect(field(section)).toHaveValue('');
      // Choisir ne ferme pas le panneau : il réapparaît à la place des suggestions.
      expect(await drawerOpen(section)).toBe(true);
      await expect(section.getByRole('article')).toHaveCount(2);

      await page.keyboard.press('Backspace');
      await expect(section.getByRole('button', { name: locale.remove(locale.kafka) })).toHaveCount(
        0,
      );
      await expect(page).not.toHaveURL(/tech=/);
      await expect(section.getByRole('article')).toHaveCount(8);

      await page.keyboard.press('Escape');
      expect(await drawerOpen(section)).toBe(false);
      await expect(field(section)).toBeFocused();
      // Le retour de focus après Échap n'a pas rouvert le panneau.
      await page.waitForTimeout(600);
      expect(await drawerOpen(section)).toBe(false);
      await expect(drawer(section)).toBeHidden();
    });

    test('saisie : Échap vide d’abord le champ, une techno sans résultat est désactivée', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=typescript,docker');
      await field(section).focus();

      await page.keyboard.type('node');
      const suggestions = section.getByRole('group', {
        name: code === 'fr' ? 'Suggestions de technos' : 'Tech suggestions',
      });
      const first = suggestions.getByRole('button').first();
      await expect(first).toHaveAttribute('aria-disabled', 'true');
      // Entrée n'ajoute pas une techno qui donnerait 0 résultat.
      await page.keyboard.press('Enter');
      await expect(
        section.getByRole('button', { name: /^(Retirer le filtre|Remove filter)/ }),
      ).toHaveCount(2);

      await page.keyboard.press('Escape');
      await expect(field(section)).toHaveValue('');
      await expect(suggestions).toHaveCount(0);
      expect(await drawerOpen(section)).toBe(true);
    });

    test('panneau : toutes les technos, états, Fermer rend le focus sans rouvrir', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=typescript,docker');
      await field(section).focus();
      expect(await drawerOpen(section)).toBe(true);

      const toggle = section.getByRole('button', { name: locale.allTechs });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(section.getByRole('button', { name: locale.hideAll })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      const all = section.locator('.all-techs');
      await expect(all).toBeVisible();
      // Techno qui donnerait 0 résultat : désactivée mais focalisable ; sans expérience : pointillé.
      const node = all.locator('button[aria-disabled="true"]').first();
      await expect(node).toBeVisible();
      await node.click({ force: true });
      await expect(
        section.getByRole('button', { name: /^(Retirer le filtre|Remove filter)/ }),
      ).toHaveCount(2);
      await expect(all.locator('.tech-chip--dashed').first()).toBeVisible();
      expect(
        await all
          .locator('.tech-chip--dashed')
          .first()
          .evaluate((element) => element.tagName),
      ).toBe('SPAN');
      await section.locator('.filter-drawer__close').click();
      expect(await drawerOpen(section)).toBe(false);
      await expect(field(section)).toBeFocused();
      await page.waitForTimeout(600);
      expect(await drawerOpen(section)).toBe(false);
    });

    test('panneau : choisir une techno du panneau ne le ferme pas et met à jour les compteurs', async ({
      page,
    }) => {
      const section = await openExperience(page, code);
      await field(section).click();
      const quick = section.locator('.filter-drawer__quick');
      await expect(quick).toBeVisible();

      await quick.getByRole('button', { name: /^Docker/ }).click();

      await expect(page).toHaveURL(/\?tech=docker$/);
      expect(await drawerOpen(section)).toBe(true);
      await expect(quick.getByRole('button', { name: /^Docker/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(quick.getByRole('button', { name: /^TypeScript/ })).toContainText('2');
      await expect(quick.getByRole('button', { name: /^Node\.js/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    test('le panneau se ferme au défilement de la liste', async ({ page }) => {
      const section = await openExperience(page, code);
      await field(section).click();
      expect(await drawerOpen(section)).toBe(true);
      await page.waitForTimeout(600);

      await section.getByRole('region', { name: locale.list }).evaluate((element) => {
        element.scrollTop = 200;
      });

      await expect.poll(async () => drawerOpen(section)).toBe(false);
    });

    test('résultats : groupe complet, autres expériences atténuées, état vide', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=typescript,docker');

      await expect(section.getByText(locale.withAll, { exact: true })).toBeVisible();
      await expect(section.getByRole('article')).toHaveCount(2);
      const show = section.getByRole('button', { name: locale.showOthers });
      await expect(show).toHaveAttribute('aria-expanded', 'false');
      await show.click();

      await expect(section.getByRole('button', { name: locale.hideOthers })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(section.getByText(locale.othersTitle, { exact: true })).toBeVisible();
      await expect(section.getByRole('article')).toHaveCount(8);
      await expect(section.getByText(locale.partial, { exact: true })).toHaveCount(2);
      const dimmed = section.locator('.experience-card--dimmed').first();
      expect(
        Number(await dimmed.evaluate((element) => getComputedStyle(element).opacity)),
      ).toBeLessThan(1);

      await section.getByRole('button', { name: locale.hideOthers }).click();
      await expect(section.getByRole('article')).toHaveCount(2);

      // Aucune expérience ne combine tout : pas de page vide.
      const empty = await openExperience(page, code, '?tech=typescript,php');
      await expect(empty.getByText(locale.empty, { exact: false }).first()).toBeVisible();
      await expect(empty.getByRole('article')).toHaveCount(0);
      await empty.getByRole('button', { name: locale.showAll }).click();
      await expect(empty.getByRole('article')).toHaveCount(8);
    });

    test('carte : accordéon au clavier, aria-expanded et durée de 320 ms', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const section = await openExperience(page, code);
      const toggle = section.getByRole('button', { name: locale.detail });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
      await expect(panel).toBeHidden();
      expect(
        await panel.evaluate((element) => getComputedStyle(element).transitionDuration),
      ).toContain('0.32s');

      await toggle.focus();
      await page.keyboard.press('Enter');

      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('listitem')).toHaveCount(4);
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(panel).toBeHidden();
    });

    test('carte : sous mouvement réduit, l’accordéon s’ouvre sans animation', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const section = await openExperience(page, code);
      const toggle = section.getByRole('button', { name: locale.detail });
      const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);

      await toggle.click();

      expect(
        await panel.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).transitionDuration),
        ),
      ).toBeLessThan(0.001);
      await expect(panel).toBeVisible();
    });

    test('carte : une puce filtre (aria-pressed, URL, remonte la liste) et se retire au second clic', async ({
      page,
    }) => {
      const section = await openExperience(page, code);
      const list = section.getByRole('region', { name: locale.list });
      await list.evaluate((element) => {
        element.scrollTop = 300;
      });

      const chip = section
        .getByRole('button', { name: locale.filterBy('Docker'), exact: true })
        .first();
      await chip.click();

      await expect(page).toHaveURL(/\?tech=docker$/);
      await expect(section.getByRole('button', { name: locale.remove('Docker') })).toBeVisible();
      await expect(
        section.getByRole('button', { name: locale.filterBy('Docker'), exact: true }).first(),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => list.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(section.getByRole('article')).toHaveCount(4);

      await section
        .getByRole('button', { name: locale.filterBy('Docker'), exact: true })
        .first()
        .click();
      await expect(page).not.toHaveURL(/tech=/);
      await expect(section.getByRole('article')).toHaveCount(8);
    });

    test('effacer, puces du champ : retirer une puce rend le focus au champ sans ouvrir le panneau', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=typescript,docker');

      await section.getByRole('button', { name: locale.remove('TypeScript') }).click();
      await expect(page).toHaveURL(/\?tech=docker$/);
      await expect(field(section)).toBeFocused();
      expect(await drawerOpen(section)).toBe(false);

      await section.getByRole('button', { name: locale.clearAll }).click();
      await expect(page).not.toHaveURL(/tech=/);
      await expect(section.getByRole('article')).toHaveCount(8);
    });

    test('le filtre survit au rechargement et au changement d’onglet', async ({ page }) => {
      const section = await openExperience(page, code, '?tech=kafka');
      await expect(section.getByRole('article')).toHaveCount(2);

      if (tabsMode(page)) {
        const nav = page.getByRole('navigation', { name: locale.tabs });
        await nav.getByRole('button', { name: locale.profileTab, exact: true }).click();
        await expect(section).toBeHidden();
        await nav.getByRole('button', { name: locale.xpTab, exact: true }).click();
        await expect(section).toBeVisible();
        await expect(section.getByRole('article')).toHaveCount(2);
      }
      await expect(page).toHaveURL(/\?tech=kafka$/);

      await page.reload();
      await expectShellMounted(page);
      if (tabsMode(page)) {
        await page
          .getByRole('navigation', { name: locale.tabs })
          .getByRole('button', { name: locale.xpTab, exact: true })
          .click();
      }
      await expect(section.getByRole('article')).toHaveCount(2);
      await expect(
        section.getByRole('button', { name: locale.remove(locale.kafka) }),
      ).toBeVisible();
    });

    test('easter egg : fenêtre nommée, focus, lignes animées, Échap, retour du focus sur la puce', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const section = await openExperience(page, code);
      const chip = section.getByRole('button', { name: locale.egg.chip, exact: true });
      await chip.scrollIntoViewIfNeeded();

      await chip.click();

      const dialog = page.getByRole('dialog', { name: locale.egg.chip });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('huile-de-coude.sh');
      await expect(dialog.getByRole('button', { name: locale.egg.back })).toBeFocused();
      // Le filtre n'a pas bougé : la puce n'est pas un filtre.
      await expect(page).not.toHaveURL(/tech=/);

      // Les lignes arrivent une à une : la dernière n'est pas encore là, puis elle apparaît.
      const done = dialog.getByText(locale.egg.done);
      await expect(done).toHaveCSS('opacity', '0');
      await expect(dialog.getByText('npm install huile-de-coude')).toHaveCSS('opacity', '1', {
        timeout: 2_000,
      });
      await expect(done).toHaveCSS('opacity', '1', { timeout: 8_000 });
      const fill = dialog.locator('.egg__fill');
      await expect
        .poll(async () => fill.evaluate((element) => element.getBoundingClientRect().width))
        .toBeGreaterThan(0);

      // Piège de focus : Tab ne sort pas de la fenêtre.
      await page.keyboard.press('Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);
      await page.keyboard.press('Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(chip).toBeFocused();
    });

    test('easter egg : sous mouvement réduit, toutes les lignes sont là d’emblée ; « Retour au CV » ferme', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const section = await openExperience(page, code);
      const chip = section.getByRole('button', { name: locale.egg.chip, exact: true });
      await chip.scrollIntoViewIfNeeded();
      await chip.click();

      const dialog = page.getByRole('dialog', { name: locale.egg.chip });
      await expect(dialog.getByText(locale.egg.done)).toHaveCSS('opacity', '1', { timeout: 1_000 });
      for (const line of await dialog.locator('.egg__line').all()) {
        await expect(line).toHaveCSS('opacity', '1', { timeout: 1_000 });
      }
      await expect
        .poll(async () =>
          dialog.locator('.egg__fill').evaluate((element) => {
            const bar = element.parentElement!;
            return Math.abs(element.getBoundingClientRect().width - bar.clientWidth) < 2;
          }),
        )
        .toBe(true);

      await dialog.getByRole('button', { name: locale.egg.back }).click();
      await expect(dialog).toBeHidden();
      await expect(chip).toBeFocused();
    });

    test('easter egg : le voile ferme la fenêtre', async ({ page }) => {
      const section = await openExperience(page, code);
      const chip = section.getByRole('button', { name: locale.egg.chip, exact: true });
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      const dialog = page.getByRole('dialog', { name: locale.egg.chip });
      await expect(dialog).toBeVisible();

      await page.mouse.click(2, 2);

      await expect(dialog).toBeHidden();
    });

    test('cibles : au moins 44 px sous 1024 px, 24 px pour les puces et au-delà', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=typescript,docker');
      await field(section).click();
      const minimum = tabsMode(page) ? 44 : 24;

      const targets = [
        section.getByRole('button', { name: locale.clearAll }),
        section.getByRole('button', { name: locale.allTechs }),
        section.locator('.filter-drawer__close'),
        section.getByRole('button', { name: locale.showOthers }),
        section.locator('.accordion__toggle').first(),
        field(section),
      ];
      for (const target of targets) {
        const box = await target.boundingBox();
        expect(box?.height, String(await target.textContent())).toBeGreaterThanOrEqual(minimum);
        expect(box?.width).toBeGreaterThanOrEqual(minimum);
      }
      // Puces de techno (D17) : 24 × 24 px au moins (WCAG 2.5.8) ; hauteur de la maquette sinon.
      for (const chip of await section.locator('.tech-chip:not(.tech-chip--dashed)').all()) {
        if (!(await chip.isVisible())) continue;
        const box = await chip.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(24);
        expect(box?.width).toBeGreaterThanOrEqual(24);
      }
    });

    test('focus visible : contour de 2 px sur le cadre du champ, les puces et les boutons', async ({
      page,
    }) => {
      const section = await openExperience(page, code, '?tech=kafka');
      await section.focus();
      await page.keyboard.press('Tab');
      await expect(
        section.getByRole('button', { name: locale.remove(locale.kafka) }),
      ).toBeFocused();

      const targets: [Locator, Locator][] = [
        [
          section.getByRole('button', { name: locale.remove(locale.kafka) }),
          section.getByRole('button', { name: locale.remove(locale.kafka) }),
        ],
        // Le champ lui-même n'a pas de contour : il est porté par son cadre.
        [field(section), section.locator('.chip-input')],
      ];
      for (const [focused, outlined] of targets) {
        await focused.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(focused).toBeFocused();
        const outline = await outlined.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.outlineStyle, style.outlineWidth];
        });
        expect(outline).toEqual(['solid', '2px']);
      }
    });

    for (const palette of PALETTES) {
      test.describe(`axe WCAG 2.2 AA, palette ${palette.name}`, () => {
        // Mouvement réduit : l'état final (panneau, accordéon, lignes de la fenêtre) est celui mesuré.
        test.beforeEach(async ({ page }) => {
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await storePreferences(page, {
            theme: palette.theme,
            highContrast: palette.highContrast,
          });
        });

        test('repos et panneau déplié', async ({ page }) => {
          const section = await openExperience(page, code, '?tech=typescript,docker');
          await expect(page.locator('html')).toHaveAttribute('data-theme', palette.theme);
          await expectAxeClean(page, `${palette.name}, repos`);

          await field(section).click();
          await section.getByRole('button', { name: locale.allTechs }).click();
          await expect(section.locator('.all-techs')).toBeVisible();
          await expectAxeClean(page, `${palette.name}, panneau déplié`);
        });

        test('suggestions et autres expériences', async ({ page }) => {
          const section = await openExperience(page, code, '?tech=typescript,docker');
          await field(section).fill('s');
          const suggestions = section.getByRole('group', {
            name: code === 'fr' ? 'Suggestions de technos' : 'Tech suggestions',
          });
          await expect(suggestions).toBeVisible();
          await expectAxeClean(page, `${palette.name}, suggestions`);

          await field(section).fill('');
          await expect(drawer(section)).toHaveClass(/filter-drawer--open/);
          await section.getByRole('button', { name: locale.showOthers }).click();
          await expect(section.getByRole('button', { name: locale.hideOthers })).toHaveAttribute(
            'aria-expanded',
            'true',
          );
          await expect(section.getByText(locale.partial, { exact: true }).first()).toBeVisible();
          await expectAxeClean(page, `${palette.name}, autres expériences`);
        });

        test('état vide et accordéon ouvert', async ({ page }) => {
          const section = await openExperience(page, code, '?tech=typescript,php');
          await expect(section.getByText(locale.empty, { exact: false }).first()).toBeVisible();
          await expectAxeClean(page, `${palette.name}, état vide`);

          await section.getByRole('button', { name: locale.showAll }).click();
          await section.locator('.accordion__toggle').first().click();
          await expect(section.getByRole('article')).toHaveCount(8);
          await expectAxeClean(page, `${palette.name}, accordéon ouvert`);
        });

        test('fenêtre de l’easter egg ouverte', async ({ page }) => {
          const section = await openExperience(page, code);
          const chip = section.getByRole('button', { name: locale.egg.chip, exact: true });
          await chip.scrollIntoViewIfNeeded();
          await chip.click();
          await expect(page.getByRole('dialog', { name: locale.egg.chip })).toBeVisible();
          await expect(page.getByText(locale.egg.done)).toHaveCSS('opacity', '1');
          await expectAxeClean(page, `${palette.name}, fenêtre`);
        });
      });
    }
  });
}
