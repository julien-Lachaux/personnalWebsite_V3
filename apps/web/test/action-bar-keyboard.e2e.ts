import { expect, test } from '@playwright/test';

// Barre d'actions au clavier (constat RA-2, WCAG 2.1.1) : le défilement vers le bas masque la barre
// (SPEC § 3.1) et la rend `inert` ; un utilisateur du clavier qui descend la page avec Tab ne doit pas
// la perdre. « Lancer l'entretien » puis « CV PDF » doivent recevoir le focus depuis le haut de la page,
// sur le Profil comme sur l'XP, à 390 px (mobile) et 834 px (tablette). La taille de fenêtre est posée
// par chaque groupe : le parcours ne dépend pas du projet Playwright choisi.

const LOCALES = {
  fr: { path: '/', nav: 'Sections', tabs: { profile: 'Profil', xp: 'XP' }, contact: 'Lancer' },
  en: { path: '/en', nav: 'Sections', tabs: { profile: 'Profile', xp: 'XP' }, contact: 'Start' },
} as const;

const SIZES = [
  { width: 390, height: 844 },
  { width: 834, height: 1112 },
] as const;

/** Nombre de Tab au plus : la page entière (cartes, puces, liens) se parcourt en moins de 400. */
const MAX_TABS = 400;

for (const size of SIZES) {
  test.describe(`${size.width} px`, () => {
    test.use({ viewport: size });

    for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      const locale = LOCALES[code];
      for (const tab of ['profile', 'xp'] as const) {
        test(`${code} : Tab atteint « Lancer l’entretien » puis « CV PDF » sur l’onglet ${tab}`, async ({
          page,
        }) => {
          await page.goto(locale.path);
          await expect(page.locator('.app-shell[data-mode="tabs"]')).toHaveCount(1);
          const nav = page.getByRole('navigation', { name: locale.nav });
          await nav.getByRole('button', { name: locale.tabs[tab], exact: true }).click();
          await expect(
            page.locator(`#section-${tab === 'xp' ? 'experience' : 'profile'}`),
          ).toBeVisible();
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

          let contact = false;
          let cv = false;
          for (let index = 0; index < MAX_TABS && !cv; index += 1) {
            await page.keyboard.press('Tab');
            const { text, href, controls } = await page.evaluate(() => {
              const element = document.activeElement;
              return {
                text: (element?.textContent ?? '').trim(),
                href: element instanceof HTMLAnchorElement ? element.getAttribute('href') : null,
                controls: element?.getAttribute('aria-controls') ?? null,
              };
            });
            if (!contact && text.startsWith(locale.contact) && href?.startsWith('mailto:')) {
              contact = true;
            } else if (contact && controls !== null && text === 'CV PDF') {
              // D44 : « CV PDF » est le bouton du menu (il commande la liste des versions).
              cv = true;
            }
          }
          expect(contact, '« Lancer l’entretien » a reçu le focus').toBe(true);
          expect(cv, '« CV PDF » a reçu le focus après lui').toBe(true);
        });
      }
    }
  });
}
