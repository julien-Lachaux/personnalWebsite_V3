// Assistants communs des parcours Playwright du front (lot F11, F11-03 ; RC-7 de la revue F10).
// Chacun reprend la meilleure des copies qui étaient recopiées dans les parcours, avec la même
// sémantique ; `test/e2e-support.e2e.ts` les exerce un par un (témoins compris). La migration des
// parcours existants vers ce module se fait sans changer leurs assertions (compte rendu du lot F11).
//
// - `WCAG_22_AA` : étiquettes axe des critères A et AA des WCAG 2.0, 2.1 et 2.2 (D4) ; tableau figé.
// - `analyzeWcag22AA(page)` : analyse axe de la page sur ces étiquettes, résultats bruts (pour un
//   parcours qui lit `incomplete`, `passes` ou attend des violations, comme un témoin).
// - `expectAxeClean(page, label?)` : la vérification complète, copie de shell, matrix et experience :
//   attend la fin des animations finies (axe mesure les couleurs rendues, fausses pendant un fondu,
//   F5D-2), puis aucune violation et le contraste effectivement mesuré (`color-contrast` parmi les
//   règles réussies : une page dont axe n'a mesuré aucun contraste ne passe pas).
// - `STORAGE_KEY` et `storePreferences(page, préférences)` : préférences enregistrées avant tout script
//   de la page, au format de `domain/preferences` (`{ version: 1, … }`). La clé est écrite ici en clair,
//   pas importée du code : c'est l'oracle, un changement de clé en production doit faire échouer.
// - `PALETTES` : les quatre palettes (thème sombre ou clair, contraste normal ou renforcé), nom des
//   cas et préférences à enregistrer, dans l'ordre des copies de shell, experience et des puces.
// - `tabsMode(page)` : vrai sous 1024 px (vue par onglets), faux au-delà (mosaïque), d'après la taille
//   de la fenêtre du projet (`MOSAIC_QUERY`, `BREAKPOINTS.portable`).
// - `gotoMounted(page, chemin, options?)` : `goto` puis `expectShellMounted` ; rend la réponse.
//   `expectShellMounted(page)` : la coquille a choisi son mode (`.app-shell[data-mode]`, posé au
//   montage), donc l'application est hydratée et un seul jeu d'en-têtes est présent.
// - `waitForHydration(page)` : application Vue montée sur `#__nuxt` (pages sans coquille : pages
//   annexes, d'erreur).
// - `waitForSettledAnimations(page, scope?)` : attend qu'aucune animation ou transition FINIE ne tourne
//   plus, sur tout le document ou, avec `scope`, sur l'élément et ses descendants. Les animations
//   infinies (indice de défilement, curseur du placeholder IA, D27) ne s'arrêtent jamais : ignorées.
//   Sondage à chaque image (`waitForFunction`) plutôt qu'attente des promesses `finished` : une
//   animation infinie n'y bloque rien, et une animation annulée (transition interrompue), dont la
//   promesse `finished` est rejetée, ne fait pas échouer l'attente.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, type Response } from '@playwright/test';

/** Étiquettes axe : critères A et AA des WCAG 2.0, 2.1 et 2.2 (D4, SPEC § 10). */
export const WCAG_22_AA: readonly string[] = Object.freeze([
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
]);

/** Clé du stockage local des préférences (`domain/preferences`), écrite en clair : oracle. */
export const STORAGE_KEY = 'siteperso:preferences';

/** Les quatre palettes : `name` nomme le cas, `theme` et `highContrast` sont les préférences. */
export const PALETTES = [
  { name: 'sombre', theme: 'sombre', highContrast: false },
  { name: 'clair', theme: 'clair', highContrast: false },
  { name: 'sombre renforcé', theme: 'sombre', highContrast: true },
  { name: 'clair renforcé', theme: 'clair', highContrast: true },
] as const;

/** Largeur à partir de laquelle la coquille passe en mosaïque (`MOSAIC_QUERY`). */
const MOSAIC_MIN_WIDTH = 1024;

/** Résultats d'une analyse axe. */
export type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** Analyse axe de la page courante sur les critères WCAG 2.2 AA ; résultats bruts. */
export async function analyzeWcag22AA(page: Page): Promise<AxeResults> {
  return new AxeBuilder({ page }).withTags([...WCAG_22_AA]).analyze();
}

/**
 * Page conforme pour axe (WCAG 2.2 AA) : animations finies terminées, aucune violation, contraste
 * mesuré. `label` nomme le cas dans les messages d'échec. Rend les résultats.
 */
export async function expectAxeClean(page: Page, label?: string): Promise<AxeResults> {
  await waitForSettledAnimations(page);
  const results = await analyzeWcag22AA(page);
  expect(results.violations, label).toEqual([]);
  expect(
    results.passes.map((rule) => rule.id),
    label,
  ).toContain('color-contrast');
  return results;
}

/** Enregistre des préférences avant tout script de la page (format de `domain/preferences`). */
export async function storePreferences(
  page: Page,
  preferences: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: JSON.stringify({ version: 1, ...preferences }),
  });
}

/** Vrai sous 1024 px : la coquille est en onglets ; faux au-delà (mosaïque). */
export function tabsMode(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < MOSAIC_MIN_WIDTH;
}

/** La coquille a choisi son mode : l'application est montée (hydratée). */
export async function expectShellMounted(page: Page): Promise<void> {
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
}

/** Ouvre `path` et attend le montage de la coquille ; rend la réponse de la navigation. */
export async function gotoMounted(
  page: Page,
  path: string,
  options?: Parameters<Page['goto']>[1],
): Promise<Response | null> {
  const response = await page.goto(path, options);
  await expectShellMounted(page);
  return response;
}

/** Attend l'hydratation : application Vue montée sur `#__nuxt` (pages sans coquille). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector<Element & { __vue_app__?: unknown }>('#__nuxt');
    return root?.__vue_app__ !== undefined;
  });
}

/**
 * Attend qu'aucune animation ou transition finie ne tourne plus : sur tout le document, ou sur `scope`
 * et ses descendants. Les animations infinies sont ignorées.
 */
export async function waitForSettledAnimations(page: Page, scope?: Locator): Promise<void> {
  const root = scope === undefined ? null : await scope.elementHandle();
  try {
    await page.waitForFunction(
      (element) =>
        (element === null
          ? document.getAnimations()
          : element.getAnimations({ subtree: true })
        ).every(
          (animation) =>
            animation.playState !== 'running' ||
            animation.effect?.getComputedTiming().endTime === Infinity,
        ),
      root,
    );
  } finally {
    await root?.dispose();
  }
}
