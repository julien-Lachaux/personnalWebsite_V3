#!/usr/bin/env node
// Cohérence de la matrice CI « front-parcours » (L26-03) : ses `project` doivent être exactement les noms de
// `viewports` d'apps/web/playwright.config.ts (mêmes noms, même ordre). Lecture des deux fichiers, aucune
// dépendance ; code 1 avec la différence sinon.
//   check-front-matrix.mjs [playwright.config.ts] [ci.yml]
import { readFileSync } from 'node:fs';

const [config = 'apps/web/playwright.config.ts', workflow = '.github/workflows/ci.yml'] =
  process.argv.slice(2);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const viewportNames = (text) => {
  const block = /export const viewports = \[([\s\S]*?)\]\s*as const/.exec(text);
  if (!block) fail(`${config} : tableau « viewports » introuvable.`);
  return [...block[1].matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
};

const matrixProjects = (text) => {
  const job = /^ {2}front-parcours:\n([\s\S]*?)(?=^ {2}\S|(?![\s\S]))/m.exec(text);
  if (!job) fail(`${workflow} : job « front-parcours » introuvable.`);
  const list = /^ {8}project:\n((?: {10}- .+\n)+)/m.exec(job[1]);
  if (!list) fail(`${workflow} : liste « matrix.project » de front-parcours introuvable.`);
  return list[1]
    .trim()
    .split('\n')
    .map((line) => line.replace(/^\s*- /, '').trim());
};

const expected = viewportNames(readFileSync(config, 'utf8'));
const actual = matrixProjects(readFileSync(workflow, 'utf8'));
if (expected.length === 0) fail(`${config} : « viewports » est vide.`);

if (JSON.stringify(expected) !== JSON.stringify(actual)) {
  fail(
    `La matrice front-parcours diverge des viewports de Playwright.\n` +
      `  viewports : ${expected.join(', ')}\n  matrice   : ${actual.join(', ')}`,
  );
}
process.stdout.write(`Matrice front-parcours cohérente (${expected.length} écrans).\n`);
