/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Libellés d'interface (CLAUDE.md, « Front ») : un fichier commun et un fichier par section, par
// langue ; un fichier de section ne contient que l'espace de clés de sa section, et le français et
// l'anglais ont exactement les mêmes clés (les deux langues livrées au même commit).

const localesRoot = join(import.meta.dirname, '../i18n/locales');
const sections = ['shell', 'profile', 'experience', 'recommendations', 'ai'];

type Messages = Record<string, unknown>;

function read(language: string, name: string): Messages {
  return JSON.parse(readFileSync(join(localesRoot, language, `${name}.json`), 'utf8')) as Messages;
}

/** Chemins de toutes les feuilles (`home.title`…) et des objets vides d'un arbre de messages. */
function keyPaths(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const children = keyPaths(value as Messages, `${path}.`);
      return children.length > 0 ? children : [`${path}.`];
    }
    return [path];
  });
}

describe('fichiers de libellés', () => {
  it('a, pour chaque langue, le fichier commun et un fichier par section, sans autre fichier', () => {
    for (const language of ['fr', 'en']) {
      expect(readdirSync(join(localesRoot, language)).sort()).toEqual(
        ['common', ...sections].map((name) => `${name}.json`).sort(),
      );
    }
  });

  it('limite chaque fichier de section à son espace de clés, et le commun aux autres', () => {
    for (const language of ['fr', 'en']) {
      for (const section of sections) {
        expect(Object.keys(read(language, section)), `${language}/${section}`).toEqual([section]);
      }
      const common = Object.keys(read(language, 'common'));
      expect(
        common.filter((key) => sections.includes(key)),
        `${language}/common`,
      ).toEqual([]);
    }
  });

  it('donne exactement les mêmes clés en français et en anglais', () => {
    for (const name of ['common', ...sections]) {
      expect(keyPaths(read('en', name)).sort(), name).toEqual(keyPaths(read('fr', name)).sort());
    }
  });

  it('repère une clé présente dans une seule langue (témoin du comparateur)', () => {
    expect(keyPaths({ home: { title: 'a', intro: 'b' }, ai: {} }).sort()).toEqual([
      'ai.',
      'home.intro',
      'home.title',
    ]);
    expect(keyPaths({ home: { title: 'a' } })).not.toEqual(
      keyPaths({ home: { title: 'a', intro: 'b' } }),
    );
  });
});
