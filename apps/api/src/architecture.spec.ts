import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Règle hexagonale de CLAUDE.md, vérifiée par le code (critère D8 du backlog, étendu à db/). */
const sourceRoot = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Fichiers de `directory` (relatifs à `src/`) dont une importation correspond à `forbidden`. */
function offenders(
  directory: string,
  forbidden: RegExp,
  allowed: readonly string[] = [],
): string[] {
  return sourceFiles(join(sourceRoot, directory))
    .filter((file) => forbidden.test(readFileSync(file, 'utf8')))
    .map((file) => relative(sourceRoot, file))
    .filter((file) => !allowed.includes(file));
}

describe('architecture hexagonale', () => {
  it('domain et application n’importent ni Nest, ni Fastify, ni Drizzle, ni le driver postgres', () => {
    const forbidden = /from '(@nestjs\/|fastify|drizzle-orm|postgres)/;

    expect(offenders('domain', forbidden)).toEqual([]);
    expect(offenders('application', forbidden)).toEqual([]);
  });

  it('infrastructure/db n’importe Nest que dans son module (dépôts sans décorateur)', () => {
    expect(
      offenders('infrastructure/db', /from '@nestjs\//, ['infrastructure/db/database.module.ts']),
    ).toEqual([]);
  });

  it('les cas d’usage de l’application n’ont aucun décorateur', () => {
    expect(offenders('application', /^@[A-Z]\w+\(/m)).toEqual([]);
  });
});
