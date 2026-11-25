import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D41 : les textes du Profil reprennent les tokens de taille de la section IA, à chaque point de rupture
// (texte courant ↔ texte courant, méta ↔ méta). Lecture du CSS des composants : jsdom ne calcule pas
// les feuilles `scoped`.

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

/** Jeton `font-size` d'un sélecteur, au niveau racine (`desktop` faux) ou dans `@media (min-width: 1024px)`. */
const fontSize = (source: string, selector: string, desktop: boolean): string => {
  const style = source.slice(source.indexOf('<style'));
  const mediaStart = style.indexOf('@media (min-width: 1024px)');
  const scope = desktop ? style.slice(mediaStart) : style.slice(0, mediaStart);
  const escaped = selector.replace(/[.\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|[\\s,])${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g');
  const sizes = [...scope.matchAll(rule)]
    .map((match) => /font-size:\s*var\((--[a-z0-9-]+)\)/.exec(match[1] ?? '')?.[1])
    .filter((token): token is string => token !== undefined);
  return sizes.at(-1) ?? 'absent';
};

const ai = read('../ai/AiSection.vue');
const profile = read('./ProfileSection.vue');
const situation = read('./SituationCard.vue');

describe('tailles de texte du Profil (D41)', () => {
  it.each([false, true])(
    'texte courant du Profil = texte courant de la section IA (bureau : %s)',
    (desktop) => {
      const reference = fontSize(ai, '.ai__text', desktop);
      expect(reference).not.toBe('absent');
      for (const selector of ['.profile__mission', '.profile__intro', '.profile__taglines']) {
        expect(fontSize(profile, selector, desktop), selector).toBe(reference);
      }
      for (const selector of ['.situation__now', '.situation__value']) {
        expect(fontSize(situation, selector, desktop), selector).toBe(reference);
      }
    },
  );

  it("méta de l'encart = étiquette de la section IA, à toutes les largeurs", () => {
    const reference = fontSize(ai, '.ai__label', false);
    expect(reference).toBe('--font-size-small');
    for (const selector of ['.situation__title', '.situation__term']) {
      expect(fontSize(situation, selector, false), selector).toBe(reference);
    }
  });
});
