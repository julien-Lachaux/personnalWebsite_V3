import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D45 : les textes d'Expérience reprennent les tokens de taille de la section IA (méthode de
// `profile/text-sizes.spec.ts`). Lecture du CSS des composants : jsdom ne calcule pas les feuilles `scoped`.

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const MEDIA = '@media (min-width: 1024px)';

/** Jeton `font-size` d'un sélecteur, hors média (`desktop` faux) ou dans `@media (min-width: 1024px)` (repli sur le niveau racine). */
const fontSize = (source: string, selector: string, desktop: boolean): string => {
  const style = source.slice(source.indexOf('<style'));
  const mediaStart = style.indexOf(MEDIA);
  const root = mediaStart === -1 ? style : style.slice(0, mediaStart);
  const media = mediaStart === -1 ? '' : style.slice(mediaStart);
  const escaped = selector.replace(/[.\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|[\\s,])${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g');
  const tokens = (scope: string): string[] =>
    [...scope.matchAll(rule)]
      .map((match) => /font-size:\s*(var\(--[a-z0-9-]+\)|[^;]+);/.exec(match[1] ?? '')?.[1])
      .filter((value): value is string => value !== undefined)
      .map((value) => value.replace(/^var\((.*)\)$/, '$1'));
  const inMedia = desktop ? tokens(media).at(-1) : undefined;
  return inMedia ?? tokens(root).at(-1) ?? 'absent';
};

const ai = read('../ai/AiSection.vue');
const files: Record<string, string> = Object.fromEntries(
  [
    'CardIntro',
    'ExperienceCard',
    'CardHeader',
    'ResultGroups',
    'SuggestionList',
    'AllTechs',
    'TechFilter',
    'TechOption',
    'FilterDrawer',
    'EasterEggWindow',
  ].map((name) => [name, read(`./${name}.vue`)]),
);

describe("tailles de texte d'Expérience (D45)", () => {
  it.each([false, true])(
    "texte courant d'Expérience = texte courant de la section IA (bureau : %s)",
    (desktop) => {
      const reference = fontSize(ai, '.ai__text', desktop);
      expect(reference).not.toBe('absent');
      const targets: [string, string][] = [
        ['CardIntro', '.card-intro__summary'],
        ['ExperienceCard', '.experience-card__details li'],
        ['ResultGroups', '.result-groups__message'],
        ['SuggestionList', '.suggestions__none'],
      ];
      for (const [file, selector] of targets) {
        expect(fontSize(files[file]!, selector, desktop), selector).toBe(reference);
      }
    },
  );

  it("petits textes d'Expérience = étiquette de la section IA, à toutes les largeurs", () => {
    const reference = fontSize(ai, '.ai__label', false);
    expect(reference).toBe('--font-size-small');
    const targets: [string, string][] = [
      ['TechOption', '.tech-option__count'],
      ['AllTechs', '.all-techs__title'],
      ['TechFilter', '.tech-filter__label'],
      ['FilterDrawer', '.filter-drawer__label'],
      ['EasterEggWindow', '.egg__terminal'],
    ];
    for (const [file, selector] of targets) {
      for (const desktop of [false, true]) {
        expect(fontSize(files[file]!, selector, desktop), selector).toBe(reference);
      }
    }
  });

  it("le titre d'une carte prend le token de titre de tuile, pas une taille écrite en dur", () => {
    for (const desktop of [false, true]) {
      expect(fontSize(files['CardHeader']!, '.card-header__title', desktop)).toBe(
        '--font-size-h3-tile',
      );
    }
  });
});
