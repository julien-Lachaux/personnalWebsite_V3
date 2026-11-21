import { expect, test, type Locator, type Page } from '@playwright/test';

// Parcours de la page intégrée (lot F5c : les quatre sections dans la coquille), à chaque taille d'écran
// des maquettes, en français et en anglais, sur les fixtures :
// - un seul `h1` (celui de la coquille, masqué visuellement), le grand titre visible est celui du profil ;
// - recommandations : citations et légendes dans la langue de la recommandation (`lang="fr"` sur `/en`
//   avec les fixtures), liens externes en nouvel onglet avec `rel="noopener noreferrer"`, pas de bouton
//   GitHub (les fixtures n'en ont pas) ;
// - sélecteur de langue : `?tech=` conservé en passant d'une langue à l'autre (D21, les slugs sont les
//   mêmes dans les deux langues) ;
// - onglets (sous 1024 px) : pendant l'onglet XP, `<main>` ne défile pas et n'a pas de marge, la liste
//   défile seule et c'est elle que lisent la flèche « faire défiler » et la barre d'actions ; marge haute
//   de 28 px des onglets Recos et IA (20 px pour le Profil), comme la maquette mobile. Au-delà (en
//   attendant la mosaïque, F6) : la section Expérience tient dans la fenêtre et sa liste défile seule.
// Le mode se déduit de la largeur du projet : chaque test vérifie le comportement de la sienne.
// axe tourne déjà sur chaque section dans shell.e2e.ts (page entière, quatre palettes).

const LOCALES = {
  fr: {
    path: '/',
    other: { path: '/en', removeDocker: 'Remove filter Docker', xpTab: 'XP' },
    title: 'Développeur full-stack',
    visibleTitle: /^Développeur\s*full-stack\s*senior$/,
    removeKafka: 'Retirer le filtre Apache Kafka',
    filterDocker: 'Filtrer par Docker',
    list: 'Liste des expériences',
    tabs: { profile: 'Profil', xp: 'XP', recos: 'Recos', ai: 'IA' },
  },
  en: {
    path: '/en',
    other: { path: '/', removeDocker: 'Retirer le filtre Docker', xpTab: 'XP' },
    title: 'Full-stack developer',
    visibleTitle: /^Full-stack\s*developer\s*senior$/,
    removeKafka: 'Remove filter Apache Kafka',
    filterDocker: 'Filter by Docker',
    list: 'List of experiences',
    tabs: { profile: 'Profile', xp: 'XP', recos: 'Recs', ai: 'AI' },
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

/** Sous 1024 px : onglets (une section à la fois) ; au-delà : sections ensemble. */
function tabsMode(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

/** Page chargée et hydratée (la coquille a choisi son mode). */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
}

/** Choisit un onglet du bas (sous 1024 px) ; sans effet au-delà, où toutes les sections sont là. */
async function tab(page: Page, name: string): Promise<void> {
  if (!tabsMode(page)) return;
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name, exact: true })
    .click();
}

/** Attend la fin des animations d'un élément (glissement de l'onglet). */
async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)).then(
      () => undefined,
    ),
  );
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} (${locale.path})`, () => {
    test('titre : un seul h1, masqué visuellement ; le grand titre visible est celui du profil', async ({
      page,
    }) => {
      await open(page, locale.path);

      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveText(locale.title);
      const box = await heading.boundingBox();
      expect([box?.width, box?.height]).toEqual([1, 1]);
      const visible = page.locator('#section-profile .profile-title');
      await expect(visible).toBeVisible();
      await expect(visible).toHaveText(locale.visibleTitle);
      expect(await visible.evaluate((element) => element.tagName)).toBe('DIV');
    });

    test('recommandations : citations et légendes dans la langue de la recommandation', async ({
      page,
    }) => {
      await open(page, locale.path);
      await tab(page, locale.tabs.recos);

      const section = page.locator('#section-recommendations');
      const quotes = section.locator('blockquote');
      await expect(quotes).toHaveCount(3);
      await expect(quotes.first()).toBeVisible();
      // Les fixtures servent des recommandations écrites en français, même sur /en (repli de langue).
      for (const element of await section.locator('blockquote, figcaption').all()) {
        await expect(element).toHaveAttribute('lang', 'fr');
      }
      await expect(page.locator('html')).toHaveAttribute('lang', code);
    });

    test('liens externes : nouvel onglet et rel="noopener noreferrer" ; pas de GitHub', async ({
      page,
    }) => {
      await open(page, locale.path);

      const external = page.locator('a[target="_blank"]');
      // LinkedIn du profil, lien du haut et bouton du bas des recommandations.
      expect(await external.count()).toBeGreaterThanOrEqual(3);
      for (const link of await external.all()) {
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link).toHaveAttribute('href', /^https:\/\//);
      }
      await expect(page.locator('#section-recommendations a[target="_blank"]')).toHaveCount(2);
      await expect(page.locator('#section-profile a[target="_blank"]')).toHaveCount(1);
      // Les fixtures n'ont pas de lien GitHub : aucun bouton GitHub.
      await expect(page.getByRole('link', { name: /github/i })).toHaveCount(0);
      await expect(page.locator('a[href*="github"]')).toHaveCount(0);
    });

    test('sélecteur de langue : le filtre ?tech= suit le changement de langue', async ({
      page,
    }) => {
      await open(page, `${locale.path}?tech=kafka`);
      await tab(page, locale.tabs.xp);
      await expect(page.getByRole('button', { name: locale.removeKafka })).toBeVisible();

      const link = page.locator('.language-switch').getByRole('link');
      await expect(link).toHaveAttribute('href', `${locale.other.path}?tech=kafka`);

      // Une techno choisie après le chargement met aussi le lien à jour.
      await page.getByRole('button', { name: locale.removeKafka }).click();
      await page
        .locator('#section-experience')
        .getByRole('button', { name: locale.filterDocker, exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(/\?tech=docker$/);
      await expect(link).toHaveAttribute('href', `${locale.other.path}?tech=docker`);

      await link.click();
      await expect(page.locator('html')).toHaveAttribute('lang', code === 'fr' ? 'en' : 'fr');
      await expect(page).toHaveURL(new RegExp(`${locale.other.path}\\?tech=docker$`));
      await tab(page, locale.other.xpTab);
      await expect(page.getByRole('button', { name: locale.other.removeDocker })).toBeVisible();
    });

    test('section Expérience : la liste défile seule, dans la hauteur disponible', async ({
      page,
    }) => {
      await open(page, locale.path);
      await tab(page, locale.tabs.xp);
      const section = page.locator('#section-experience');
      const list = page.getByRole('region', { name: locale.list });
      await expect(list).toBeVisible();
      await settled(section);
      expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        true,
      );
      const viewport = page.viewportSize()?.height ?? 0;
      const box = await section.boundingBox();
      expect(box?.height ?? Infinity).toBeLessThanOrEqual(viewport);

      if (!tabsMode(page)) {
        // Bureau, avant la mosaïque : pas de barre d'actions ni de flèche ; la section tient dans une
        // fenêtre (sa position dépend de la hauteur de la barre du haut, qui varie selon la langue).
        await expect(page.locator('.action-bar, .scroll-hint')).toHaveCount(0);
        return;
      }
      // Onglet XP : <main> ne défile pas et n'a pas de marge.
      const main = page.locator('main#contenu');
      const style = await main.evaluate((element) => {
        const computed = getComputedStyle(element);
        return [
          computed.overflowY,
          computed.paddingTop,
          computed.paddingLeft,
          computed.paddingBottom,
        ];
      });
      expect(style).toEqual(['hidden', '0px', '0px', '0px']);
      expect(await main.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0);
      // La liste a du contenu caché : la flèche est là et fait défiler la liste.
      const hint = page.locator('.scroll-hint');
      await expect(hint).toBeVisible();
      await hint.click();
      await expect
        .poll(async () => list.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      // Défiler la liste vers le bas masque la barre d'actions.
      await list.evaluate((element) => {
        element.scrollTop += 400;
      });
      await expect(page.locator('.action-bar')).toHaveClass(/action-bar--hidden/);
    });

    test('marge haute du contenu : 20 px pour le Profil, 28 px pour Recos et IA (onglets)', async ({
      page,
    }) => {
      await open(page, locale.path);
      const main = page.locator('main#contenu');
      const paddingTop = async (): Promise<string> =>
        main.evaluate((element) => getComputedStyle(element).paddingTop);

      if (!tabsMode(page)) {
        // Bureau : la marge de la zone de 1440 px, la même pour toutes les sections.
        expect(await paddingTop()).toBe('12px');
        return;
      }
      expect(await paddingTop()).toBe('20px');
      await tab(page, locale.tabs.recos);
      expect(await paddingTop()).toBe('28px');
      await tab(page, locale.tabs.ai);
      expect(await paddingTop()).toBe('28px');
      await tab(page, locale.tabs.profile);
      expect(await paddingTop()).toBe('20px');
    });
  });
}
