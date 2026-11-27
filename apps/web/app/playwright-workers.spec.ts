/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Borne du nombre de processus Playwright (lot 43, décision du 25 nov. 2026) : playwright.config.ts
// lit TEST_MAX_WORKERS avec la même validation que vitest.config.ts et la passe à `workers`. La
// configuration est évaluée dans un processus Node séparé (Node exécute le TypeScript de la
// configuration), avec la valeur à l'essai dans l'environnement : l'environnement l'emporte sur le
// `.env` racine, et une valeur vide compte comme absente, donc le résultat ne dépend pas du `.env`
// du worktree.

const webRoot = resolve(import.meta.dirname, '..');

const EVALUATE_CONFIG = `
const config = (await import('./playwright.config.ts')).default;
process.stdout.write(JSON.stringify({ workers: config.workers ?? null }));
`;

interface Evaluation {
  status: number | null;
  stdout: string;
  stderr: string;
}

function evaluateConfig(testMaxWorkers: string): Evaluation {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', EVALUATE_CONFIG], {
    cwd: webRoot,
    env: { ...process.env, TEST_MAX_WORKERS: testMaxWorkers },
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function workersFor(testMaxWorkers: string): unknown {
  const evaluation = evaluateConfig(testMaxWorkers);
  expect(evaluation.status, evaluation.stderr).toBe(0);
  return (JSON.parse(evaluation.stdout) as { workers: unknown }).workers;
}

describe('playwright.config.ts : TEST_MAX_WORKERS', () => {
  it('ne fixe pas workers sans valeur (défaut de Playwright, CI comprise)', () => {
    expect(workersFor('')).toBeNull();
  });

  it('passe un entier positif à workers, en nombre', () => {
    expect(workersFor('2')).toBe(2);
    expect(workersFor('12')).toBe(12);
  });

  it('passe un pourcentage de 1 à 100 % tel quel', () => {
    expect(workersFor('1%')).toBe('1%');
    expect(workersFor('50%')).toBe('50%');
    expect(workersFor('100%')).toBe('100%');
  });

  it.each(['0', '-1', '1.5', '04', 'abc', '0%', '101%', '50 %', '%', ' 2'])(
    'arrête Playwright sur une valeur invalide (%j)',
    (value) => {
      const evaluation = evaluateConfig(value);
      expect(evaluation.status).not.toBe(0);
      expect(evaluation.stderr).toContain(`TEST_MAX_WORKERS invalide (« ${value} »)`);
    },
  );
});
