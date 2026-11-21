/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'vue/compiler-sfc';

// Version anglaise complète (lot F7, F7-02) : aucune chaîne d'interface écrite en dur dans un gabarit.
// Tout texte visible et tout nom accessible statique passe par `t()` (CLAUDE.md, « Front ») ; seuls les
// symboles, codes et noms propres de la liste ci-dessous, identiques dans les deux langues, restent
// écrits dans le gabarit. Ce test lit les gabarits ; test/pages.e2e.ts vérifie le rendu des pages /en.

const appRoot = import.meta.dirname;

/** Attributs statiques lus par les technologies d'assistance ou affichés. */
const NAMED_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'alt',
  'placeholder',
]);

/**
 * Textes admis dans un gabarit, identiques en fr et en en : codes de langue du sélecteur (D21), statut
 * `[ok]` des lignes de terminal de l'easter egg.
 */
const INVARIANT = new Set(['FR', 'EN', '[ok]']);

// Types de nœuds de l'arbre du compilateur de Vue (@vue/compiler-core, NodeTypes et ElementTypes).
const ELEMENT = 1;
const TEXT = 2;
const ATTRIBUTE = 6;
/** Élément HTML natif (`tagType`), par opposition à un composant, dont `title` est une prop. */
const NATIVE = 0;

interface TemplateNode {
  type: number;
  content?: string;
  tag?: string;
  tagType?: number;
  props?: { type: number; name: string; value?: { content: string } }[];
  children?: TemplateNode[];
}

/** Textes porteurs de lettres d'un arbre de gabarit : nœuds texte et attributs nommants statiques. */
function hardcodedTexts(node: TemplateNode): string[] {
  const own: string[] = [];
  if (node.type === TEXT && /\p{L}/u.test(node.content ?? ''))
    own.push((node.content ?? '').trim());
  if (node.type === ELEMENT && node.tagType === NATIVE) {
    for (const prop of node.props ?? []) {
      const value = prop.value?.content ?? '';
      if (prop.type === ATTRIBUTE && NAMED_ATTRIBUTES.has(prop.name) && /\p{L}/u.test(value)) {
        own.push(`${prop.name}="${value}"`);
      }
    }
  }
  return [...own, ...(node.children ?? []).flatMap(hardcodedTexts)];
}

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

function templateOf(source: string): TemplateNode {
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  return (descriptor.template?.ast ?? { type: 0 }) as TemplateNode;
}

describe('chaînes d’interface', () => {
  it('repère un texte, un nom accessible ou un titre écrits en dur (témoin)', () => {
    const template = templateOf(
      '<template><div><p>Bonjour</p><button aria-label="Fermer" :title="t(\'x\')">×</button>' +
        '<img alt="Portrait"><span aria-hidden="true">&gt;_</span>{{ t("y") }}<input placeholder="Nom">' +
        '<BaseWindow title="fichier.sh" /></div></template>',
    );
    expect(hardcodedTexts(template)).toEqual([
      'Bonjour',
      'aria-label="Fermer"',
      'alt="Portrait"',
      'placeholder="Nom"',
    ]);
  });

  it('aucun gabarit d’app/ n’écrit de chaîne d’interface en dur (tout passe par t())', () => {
    const offenders = vueFiles(appRoot).flatMap((file) =>
      hardcodedTexts(templateOf(readFileSync(file, 'utf8')))
        .filter((text) => !INVARIANT.has(text))
        .map((text) => `${relative(appRoot, file)} : ${text}`),
    );
    expect(offenders).toEqual([]);
  });
});

// Libellé anglais identique au français : soit un mot qui s'écrit de même dans les deux langues, soit
// une traduction oubliée. Les identiques admis sont listés ici, chacun relu (lot F7) ; toute autre
// égalité fait échouer le test.
const SAME_IN_BOTH = new Map<string, string>([
  ['experience.contractType.freelance', 'Freelance'],
  ['experience.suggestions.count', '{n} XP'],
  ['experience.easterEgg.install', 'npm install huile-de-coude'],
  ['experience.easterEgg.muscles', 'muscles'],
  ['experience.easterEgg.patience', 'patience'],
  ['profile.situation.format', 'format'],
  ['shell.nav.label', 'Sections'],
  ['shell.sections.experience', 'XP'],
  ['shell.actions.cv', 'CV PDF'],
]);

type Messages = Record<string, unknown>;

function leafValues(messages: Messages, prefix = ''): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]): [string, string][] => {
    if (typeof value === 'string') return [[`${prefix}${key}`, value]];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return leafValues(value as Messages, `${prefix}${key}.`);
    }
    return [];
  });
}

function labels(language: string): Map<string, string> {
  const directory = join(appRoot, '../i18n/locales', language);
  return new Map(
    readdirSync(directory).flatMap((file) =>
      leafValues(JSON.parse(readFileSync(join(directory, file), 'utf8')) as Messages),
    ),
  );
}

describe('traductions anglaises', () => {
  it('ne recopie aucun libellé français, hors mots identiques dans les deux langues relus', () => {
    const english = labels('en');
    const identical = [...labels('fr')].filter(([key, value]) => english.get(key) === value);
    expect(new Map(identical)).toEqual(SAME_IN_BOTH);
  });
});
