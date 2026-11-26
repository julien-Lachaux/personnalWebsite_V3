/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createFontStack } from '@capsizecss/core';
import arial from '@capsizecss/metrics/arial';
import arimo from '@capsizecss/metrics/arimo';
import courierNew from '@capsizecss/metrics/courierNew';
import cousine from '@capsizecss/metrics/cousine';
import helvetica from '@capsizecss/metrics/helvetica';
import jetBrainsMono from '@capsizecss/metrics/jetBrainsMono';
import jetBrainsMonoBold from '@capsizecss/metrics/jetBrainsMono/700';
import roboto from '@capsizecss/metrics/roboto';
import spaceGrotesk from '@capsizecss/metrics/spaceGrotesk';
import spaceGroteskBold from '@capsizecss/metrics/spaceGrotesk/700';
import { fromFile } from '@capsizecss/unpack/fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Polices de repli ajustées (D51 (4), lot F11) : chaque face de repli de `fonts.css` prête à une
// police installée (`local()`) les dimensions de Space Grotesk ou de JetBrains Mono, pour que le texte
// affiché avant leur arrivée occupe la même place (moins de saut de mise en page). Les valeurs ne se
// règlent pas à l'œil : ce test les recalcule par `createFontStack` de capsize (la technique de
// `@nuxtjs/fontaine`) depuis les métriques des woff2 servis par le site (`public/fonts/`, lues par
// `@capsizecss/unpack`) et celles de la police locale (`@capsizecss/metrics`) :
// - size-adjust = (largeur moyenne pondérée / em de la police servie)
//                 / (largeur moyenne pondérée / em de la police locale) ;
// - ascent-, descent-, line-gap-override = métrique de la police servie / (em × size-adjust).
// Une face regroupe des polices aux métriques identiques (Liberation Sans et Arimo sont la même
// police, à la chasse d'Arial et d'Helvetica ; Liberation Mono et Cousine, à celle de Courier New) :
// chaque police de la face doit donner exactement les valeurs écrites.

const cssDir = import.meta.dirname;
const fontsDir = resolve(cssDir, '../../../public/fonts');

/** Fiche de métriques, celle de @capsizecss/metrics ou celle lue dans un woff2 (sans catégorie). */
type Metrics = Omit<typeof arial, 'category'>;

interface FallbackFamily {
  family: string;
  /** woff2 servi dont la face de repli prend les dimensions (sous-ensemble latin, instance par défaut). */
  served: string;
  servedFamily: string;
  /** Fiches de capsize de la police servie, graisses normale et grasse (contrôle de chasse). */
  published: readonly [Metrics, Metrics];
  /** Polices locales de la face : métriques et noms (complet, PostScript) cherchés par `local()`. */
  locals: readonly { metrics: Metrics; names: readonly string[] }[];
}

/** Noms `local()` d'une police de capsize : nom complet puis nom PostScript. */
function names(metrics: Metrics): string[] {
  return [metrics.fullName, metrics.postscriptName];
}

// Liberation Sans et Liberation Mono n'ont pas de fiche dans @capsizecss/metrics : ce sont les
// polices Arimo et Cousine sous leur nom Liberation (mêmes métriques), d'où leurs fiches.
const FAMILIES: readonly FallbackFamily[] = [
  {
    family: 'Space Grotesk Fallback',
    served: 'space-grotesk/space-grotesk-latin-wght-normal.woff2',
    servedFamily: 'Space Grotesk',
    published: [spaceGrotesk, spaceGroteskBold],
    locals: [
      { metrics: arial, names: names(arial) },
      { metrics: helvetica, names: [helvetica.fullName] },
      { metrics: arimo, names: ['Liberation Sans', 'LiberationSans'] },
      { metrics: arimo, names: names(arimo) },
    ],
  },
  {
    family: 'Space Grotesk Fallback Roboto',
    served: 'space-grotesk/space-grotesk-latin-wght-normal.woff2',
    servedFamily: 'Space Grotesk',
    published: [spaceGrotesk, spaceGroteskBold],
    locals: [{ metrics: roboto, names: names(roboto) }],
  },
  {
    family: 'JetBrains Mono Fallback',
    served: 'jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2',
    servedFamily: 'JetBrains Mono',
    published: [jetBrainsMono, jetBrainsMonoBold],
    locals: [
      { metrics: courierNew, names: names(courierNew) },
      { metrics: cousine, names: ['Liberation Mono', 'LiberationMono'] },
      { metrics: cousine, names: names(cousine) },
    ],
  },
];

type Descriptors = Record<string, string>;

/** Descripteurs de chaque `@font-face` de fonts.css (famille sans guillemets). */
const faces: Descriptors[] = [];
postcss.parse(readFileSync(join(cssDir, 'fonts.css'), 'utf8')).walkAtRules('font-face', (rule) => {
  const face: Descriptors = {};
  rule.walkDecls((declaration) => {
    face[declaration.prop] = declaration.value.replace(/\s+/g, ' ');
  });
  face['font-family'] = (face['font-family'] ?? '').replace(/['"]/g, '');
  faces.push(face);
});

/** Descripteurs d'ajustement, tous écrits dans chaque face de repli. */
const OVERRIDES = ['ascent-override', 'descent-override', 'line-gap-override', 'size-adjust'];

function overridesOf(face: Descriptors | undefined): Descriptors {
  return Object.fromEntries(
    Object.entries(face ?? {}).filter(([name]) => OVERRIDES.includes(name)),
  );
}

/**
 * Valeurs de capsize pour une police servie et une police locale, en propriétés CSS. Capsize omet un
 * descripteur vertical qui vaudrait déjà la métrique de la police locale ; fonts.css les écrit tous
 * (les métriques verticales de la police locale ne comptent alors plus, seule sa chasse fixe
 * `size-adjust`) : elles sont masquées ici pour que capsize les rende toutes.
 */
function expectedOverrides(served: Metrics, local: Metrics): Descriptors {
  const width = { ...local, ascent: Number.NaN, descent: Number.NaN, lineGap: Number.NaN };
  const [face] = createFontStack([served, width], { fontFaceFormat: 'styleObject' }).fontFaces;
  if (face === undefined) throw new Error('capsize ne rend aucune face');
  return Object.fromEntries(
    Object.entries(face['@font-face'])
      .filter(([name]) => name !== 'fontFamily' && name !== 'src')
      .map(([name, value]) => [
        name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        String(value),
      ]),
  );
}

describe('polices de repli ajustées (fonts.css)', () => {
  const fallbacks = faces.filter((face) => face['font-family']?.includes('Fallback'));

  it('une face par famille, sans graisse ni style : gras et italique simulés sur les mêmes dimensions', () => {
    expect(fallbacks.map((face) => face['font-family'])).toEqual(
      FAMILIES.map(({ family }) => family),
    );
    for (const face of fallbacks) {
      expect(Object.keys(face).sort(), face['font-family']).toEqual(
        ['font-family', 'src', ...OVERRIDES].sort(),
      );
    }
  });

  it('ne chargent rien : uniquement des polices installées, jamais une adresse', () => {
    for (const face of fallbacks) {
      expect(face['src'], face['font-family']).toMatch(/^local\('[^']+'\)(, local\('[^']+'\))*$/);
    }
  });

  for (const { family, served, servedFamily, published, locals } of FAMILIES) {
    it(`${family} : dimensions de ${servedFamily} (${served}) pour chaque police locale`, async () => {
      const servedMetrics = await fromFile(join(fontsDir, served));
      expect(servedMetrics.familyName.startsWith(servedFamily)).toBe(true);
      const face = faces.find((candidate) => candidate['font-family'] === family);
      expect(face?.['src']).toBe(
        locals
          .flatMap(({ names: localNames }) => localNames.map((name) => `local('${name}')`))
          .join(', '),
      );
      for (const { metrics, names: localNames } of locals) {
        expect(overridesOf(face), `${family} ${localNames.join(' ')}`).toEqual(
          expectedOverrides(servedMetrics, metrics),
        );
      }
    });

    it(`${servedFamily} : même chasse de la graisse fine à la grasse (une face de repli suffit)`, async () => {
      // L'instance par défaut du woff2 variable est celle que lit capsize (Space Grotesk : Light,
      // 300) ; les fiches publiées des graisses normale et grasse ne s'en écartent pas de plus de
      // 0,5 % en largeur moyenne et ont les mêmes métriques verticales.
      const servedMetrics = await fromFile(join(fontsDir, served));
      for (const metrics of published) {
        expect(metrics.unitsPerEm).toBe(servedMetrics.unitsPerEm);
        expect([metrics.ascent, metrics.descent, metrics.lineGap]).toEqual([
          servedMetrics.ascent,
          servedMetrics.descent,
          servedMetrics.lineGap,
        ]);
        expect(Math.abs(metrics.xWidthAvg / servedMetrics.xWidthAvg - 1)).toBeLessThan(0.005);
      }
    });
  }
});
