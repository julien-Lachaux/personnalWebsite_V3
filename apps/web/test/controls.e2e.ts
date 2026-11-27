import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { gotoMounted } from './support/e2e.js';

// Puces de techno dans un vrai navigateur, à chaque taille d'écran des maquettes (lot F1 bis) :
// - D17 : hauteur de la maquette (environ 28 px) sur mobile et tablette comme ailleurs, et non 44 px ;
//   cible d'au moins 24 × 24 px (WCAG 2.2, 2.5.8), espacement compris, même collées les unes aux
//   autres, et avec le texte agrandi, la police lisible ou l'espacement augmenté ;
// - D12 : contour au token `--line-control` (3:1), la puce pointillé garde `--line`.
// Aucune page ne monte encore `TechChip` : son style livré (bloc <style scoped> du composant, lu dans
// le fichier source ; seul l'attribut de portée de Vue en diffère) est ajouté à la page générée, avec
// des puces écrites comme le composant les rend. Elles sont ajoutées dans <body>, hors de #__nuxt
// (l'hydratation retirerait un nœud inconnu), après la pose des attributs de la racine (aucune
// transition en cours au moment de la mesure).

const component = readFileSync(
  resolve(import.meta.dirname, '../app/components/base/TechChip.vue'),
  'utf8',
);
const chipStyle = /<style scoped>([\s\S]*?)<\/style>/.exec(component)?.[1];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Chip {
  label: string;
  count?: number;
  dashed?: boolean;
}

/** Pose (ou retire, valeur null) des attributs sur <html>, comme le feront les préférences. */
async function setRoot(page: Page, attributes: Record<string, string | null>): Promise<void> {
  await page.evaluate((entries) => {
    for (const [name, value] of Object.entries(entries)) {
      if (value === null) document.documentElement.removeAttribute(name);
      else document.documentElement.setAttribute(name, value);
    }
  }, attributes);
}

/** Ajoute des puces collées (aucun espace entre elles) et rend leurs boîtes, polices chargées. */
async function mountChips(
  page: Page,
  chips: readonly Chip[],
  size: 'sm' | 'md' = 'sm',
): Promise<Box[]> {
  if (chipStyle === undefined) throw new Error('aucun bloc <style scoped> dans TechChip.vue');
  await page.addStyleTag({ content: chipStyle });
  return page.evaluate(
    async ({ chips: list, size: chipSize }) => {
      const row = document.createElement('div');
      row.dataset['testid'] = 'chips';
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:0;align-items:flex-start';
      for (const { label, count, dashed } of list) {
        const chip = document.createElement(dashed === true ? 'span' : 'button');
        if (chip instanceof HTMLButtonElement) chip.type = 'button';
        chip.className = `tech-chip tech-chip--${chipSize}${dashed === true ? ' tech-chip--dashed' : ''}`;
        chip.append(label);
        if (count !== undefined) {
          const counter = document.createElement('span');
          counter.className = 'tech-chip__count';
          counter.textContent = String(count);
          chip.append(counter);
        }
        row.append(chip);
      }
      document.body.prepend(row);
      await document.fonts.ready;
      return [...row.children].map((child) => {
        const { x, y, width, height } = child.getBoundingClientRect();
        return { x, y, width, height };
      });
    },
    { chips, size },
  );
}

const TARGET = 24;

/**
 * Cibles qui échouent à WCAG 2.2, 2.5.8 : une cible de moins de 24 × 24 px ne passe que si un cercle
 * de 24 px de diamètre centré sur elle ne touche aucune autre cible ni le cercle d'une autre cible
 * trop petite (exception d'espacement).
 */
function targetSizeFailures(boxes: readonly Box[]): number[] {
  const small = (box: Box): boolean => box.width < TARGET || box.height < TARGET;
  const center = (box: Box): [number, number] => [box.x + box.width / 2, box.y + box.height / 2];
  const circleTouches = ([cx, cy]: [number, number], box: Box): boolean => {
    const dx = Math.max(box.x - cx, 0, cx - (box.x + box.width));
    const dy = Math.max(box.y - cy, 0, cy - (box.y + box.height));
    return Math.hypot(dx, dy) < TARGET / 2;
  };
  return boxes.flatMap((box, index) => {
    if (!small(box)) return [];
    const own = center(box);
    const conflict = boxes.some((other, j) => {
      if (j === index) return false;
      if (circleTouches(own, other)) return true;
      const [ox, oy] = center(other);
      return small(other) && Math.hypot(own[0] - ox, own[1] - oy) < TARGET;
    });
    return conflict ? [index] : [];
  });
}

/** Libellés courts et longs, dont une lettre étroite seule (largeur minimale). */
const LABELS: readonly Chip[] = [
  { label: 'I' },
  { label: 'C', count: 1 },
  { label: 'Go' },
  { label: 'TypeScript', count: 2 },
];

test('critère 2.5.8 : cibles assez grandes, ou assez espacées (témoins de la mesure)', () => {
  const square = { width: 24, height: 24 };
  const tiny = { width: 20, height: 20 };
  expect(
    targetSizeFailures([
      { x: 0, y: 0, ...square },
      { x: 24, y: 0, ...square },
    ]),
  ).toEqual([]);
  expect(
    targetSizeFailures([
      { x: 0, y: 0, ...tiny },
      { x: 22, y: 0, ...tiny },
    ]),
  ).toEqual([0, 1]);
  expect(
    targetSizeFailures([
      { x: 0, y: 0, ...tiny },
      { x: 30, y: 0, ...tiny },
    ]),
  ).toEqual([]);
  expect(
    targetSizeFailures([
      { x: 0, y: 0, ...tiny },
      { x: 21, y: 0, ...square },
    ]),
  ).toEqual([0]);
  expect(
    targetSizeFailures([
      { x: 0, y: 0, ...tiny },
      { x: 25, y: 0, ...square },
    ]),
  ).toEqual([]);
});

test('puces des cartes : hauteur de la maquette, cible d’au moins 24 × 24 px, même collées (D17)', async ({
  page,
}) => {
  // `gotoMounted` attend l'hydratation (la coquille a choisi son mode : `data-mode`). Avant cela, le
  // montage de l'application remet les attributs de <html> aux préférences (D5) et écraserait ceux
  // qu'un test poserait juste après `goto`.
  await gotoMounted(page, '/');
  const boxes = await mountChips(page, LABELS);

  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(TARGET);
    expect(box.height).toBeGreaterThanOrEqual(TARGET);
    // Environ 28 px comme la maquette, à toutes les largeurs : plus de 44 px imposés sous 1024 px.
    expect(box.height).toBeLessThan(32);
  }
  expect(targetSizeFailures(boxes)).toEqual([]);
});

for (const [name, value] of [
  ['data-text-size', '130'],
  ['data-font', 'lisible'],
  ['data-spacing', 'augmente'],
] as const) {
  test(`puces des cartes : cible d’au moins 24 × 24 px avec ${name}="${value}"`, async ({
    page,
  }) => {
    await gotoMounted(page, '/');
    await setRoot(page, { [name]: value });
    const boxes = await mountChips(page, LABELS);

    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(TARGET);
      expect(box.height).toBeGreaterThanOrEqual(TARGET);
    }
    expect(targetSizeFailures(boxes)).toEqual([]);
  });
}

test('puces du filtre : 40 px de haut comme la maquette, à toutes les largeurs', async ({
  page,
}) => {
  await gotoMounted(page, '/');
  const boxes = await mountChips(page, LABELS, 'md');

  for (const box of boxes) {
    expect(box.height).toBe(40);
    expect(box.width).toBeGreaterThanOrEqual(TARGET);
  }
});

for (const [theme, contrast, control, decorative] of [
  ['sombre', null, 'rgb(102, 121, 138)', 'rgb(58, 75, 87)'],
  ['clair', null, 'rgb(20, 38, 43)', 'rgb(20, 38, 43)'],
  ['sombre', 'renforce', 'rgb(169, 188, 199)', 'rgb(169, 188, 199)'],
] as const) {
  test(`contour : --line-control sur la puce cliquable, --line sur la puce pointillé (${theme}${contrast === null ? '' : ', renforcé'}, D12)`, async ({
    page,
  }) => {
    await gotoMounted(page, '/');
    await setRoot(page, { 'data-theme': theme, 'data-contrast': contrast });
    await mountChips(page, [{ label: 'Go' }, { label: 'COBOL', dashed: true }]);

    const borders = await page
      .locator('[data-testid="chips"] > *')
      .evaluateAll((chips) => chips.map((chip) => getComputedStyle(chip).borderTopColor));
    expect(borders).toEqual([control, decorative]);
  });
}
