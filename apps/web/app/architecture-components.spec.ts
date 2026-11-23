/// <reference types="node" />
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// D37 (RC-4) : un composant ne lit pas la couche de données par une valeur (fonction, classe,
// constante) : la donnée entre par la page (`HomePage`) ou le composable `use-cv`, et les composants
// ne reçoivent que des vues. Les imports de types (effacés à la compilation, `import type` ou
// `import { type X }`) et de fonctions de `app/domain/` restent permis. Complète
// `architecture.spec.ts` (règles du domaine et des données) ; fichier à part parce qu'il scrute aussi
// les `.vue`.

const appRoot = import.meta.dirname;
const DATA_LAYER = /(?:^|\/)data(?:\/|$)/;
/** Seul composant autorisé à lire la couche de données : la page d'accueil, qui mappe le CV. */
const DATA_READER = join('components', 'home', 'HomePage.vue');

/** Fichiers d'interface scrutés : `.vue` et sources `.ts`/`.js`, tests écartés. */
function componentFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return /\.(?:vue|[cm]?[jt]s)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

/** Une clause `type X` ou `{ type A, type B }` ne porte aucune valeur. */
function isTypeOnlyClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (/^type\s/.test(trimmed)) return true;
  const named = /^\{([^}]*)\}$/.exec(trimmed)?.[1];
  if (named === undefined) return false;
  const specifiers = named
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return specifiers.length > 0 && specifiers.every((s) => /^type\s/.test(s));
}

/** Spécificateurs importés par une valeur : import/export statiques non typés, import(), require(). */
function valueImportSpecifiers(source: string): string[] {
  const named = [
    ...source.matchAll(/\b(?:import|export)\s+([^'"`;]*?)\s*from\s*['"]([^'"]+)['"]/g),
  ];
  const others = [
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ].flatMap((re) => [...source.matchAll(re)].map((m) => m[1] ?? ''));
  return [...named.filter((m) => !isTypeOnlyClause(m[1] ?? '')).map((m) => m[2] ?? ''), ...others];
}

/** « fichier : spécificateur » de chaque import par valeur de `app/data/` dans `root/components`. */
function dataValueImports(root: string = appRoot): string[] {
  return componentFiles(join(root, 'components'))
    .filter((file) => relative(root, file) !== DATA_READER)
    .flatMap((file) =>
      valueImportSpecifiers(readFileSync(file, 'utf8'))
        .filter((specifier) => DATA_LAYER.test(specifier))
        .map((specifier) => `${relative(root, file)} : ${specifier}`),
    );
}

describe('architecture des composants (D37)', () => {
  it('distingue les imports de valeurs des imports de types seuls', () => {
    const source = [
      "import type { ExperienceView } from '../../data/cv-view.js';",
      "import { type LinkView, type ProfileView } from '../../data/cv-view.js';",
      "import { type LinksView, } from '../../data/cv-view.js';",
      "import { mapCv } from '../../data/map-cv.js';",
      "import { type A, fetchCv } from '../../data/fetch-cv.js';",
      "import cvSource from '../../data/source.js';",
      "export type { X } from '../../data/x.js';",
      "export { y } from '../../data/y.js';",
      "import '../../data/side-effect.js';",
      "const lazy = await import('../../data/lazy.js');",
      "import { layout } from '../../domain/layout.js';",
    ].join('\n');

    expect(valueImportSpecifiers(source).sort()).toEqual(
      [
        '../../data/map-cv.js',
        '../../data/fetch-cv.js',
        '../../data/source.js',
        '../../data/y.js',
        '../../data/side-effect.js',
        '../../data/lazy.js',
        '../../domain/layout.js',
      ].sort(),
    );
  });

  it('signale un import de valeur de app/data/ dans un composant, sauf HomePage', () => {
    const root = mkdtempSync(join(tmpdir(), 'architecture-components-'));
    const script = (body: string): string => `<script setup lang="ts">\n${body}\n</script>`;
    const files: Record<string, string> = {
      'components/profile/Bad.vue': script("import { mapCv } from '../../data/map-cv.js';"),
      'components/profile/Good.vue': script(
        "import { type LinkView } from '../../data/cv-view.js';\nimport { fit } from '../../domain/fit.js';",
      ),
      'components/experience/bad-helper.ts': "export { fetchCv } from '../../data/fetch-cv.js';",
      'components/home/HomePage.vue': script("import { mapCv } from '../../data/map-cv.js';"),
      'components/profile/Bad.spec.ts': "import { mapCv } from '../../data/map-cv.js';",
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }

    expect(dataValueImports(root).sort()).toEqual([
      `${join('components', 'experience', 'bad-helper.ts')} : ../../data/fetch-cv.js`,
      `${join('components', 'profile', 'Bad.vue')} : ../../data/map-cv.js`,
    ]);
    expect(dataValueImports(join(root, 'absent'))).toEqual([]);
  });

  it('aucun composant de app/components n’importe de valeur de app/data/ (hors HomePage)', () => {
    expect(dataValueImports()).toEqual([]);
  });
});
