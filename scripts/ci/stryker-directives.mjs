#!/usr/bin/env node
// Contrôle à la ligne des directives de Stryker qui retirent des mutants du score (L14-02), appelé
// par check-tests-integrity.sh pour chaque directive ajoutée depuis le point de divergence.
//
// Entrée standard : une ligne « chemin<TAB>numéro de ligne » par directive (chemins relatifs à la
// racine du dépôt, dossier courant). Arguments : les fichiers stryker.equivalents.json du dépôt.
// Pour chaque identifiant d'équivalent cité par la directive et déclaré dans l'un de ces fichiers,
// une déclaration au moins doit désigner la ligne que la directive retire du score et un mutateur
// qu'elle désactive :
//   - fichier : champ « file », relatif au dossier du stryker.equivalents.json ;
//   - ligne : champ « line » ; la ligne suivante pour une directive next-line, sinon une ligne de la
//     plage qui va de la directive à la directive de rétablissement suivante (ou à la fin) ;
//   - mutateur : champ « mutator », obligatoire (décision de Julien du 20 nov. 2026), l'un de ceux
//     de la directive (« all » les couvre tous) ; un équivalent sans mutateur ne justifie rien.
// Un identifiant que rien ne déclare est signalé par le script d'intégrité lui-même (point 6).
// Sortie : un écart par ligne sur la sortie standard ; code 0 si l'entrée et les fichiers sont lus,
// 2 sinon (fichier d'équivalents ou de code illisible : refusé plutôt que lu de travers).

import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const ID_RE = /[A-Z]+-EQ-[0-9]+/g;
const DIRECTIVE_RE =
  /Stryker\s+disable(\s+next-line)?(?:\s+([A-Za-z][A-Za-z,\s]*?))?\s*(?::|\*\/|$)/;
const RESTORE_RE = /Stryker\s+restore/;

function fail(message) {
  process.stderr.write(`stryker-directives : ${message}\n`);
  process.exit(2);
}

/** Déclarations de tous les fichiers d'équivalents, par identifiant. */
function declarations(files) {
  const byId = new Map();
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      fail(`${file} illisible (${error.message})`);
    }
    const entries = Array.isArray(data?.equivalents) ? data.equivalents : [];
    for (const entry of entries) {
      if (typeof entry?.id !== 'string') continue;
      const list = byId.get(entry.id) ?? [];
      list.push({
        source: file,
        file:
          typeof entry.file === 'string'
            ? posix.normalize(posix.join(posix.dirname(file), entry.file))
            : null,
        line: Number.isInteger(entry.line) ? entry.line : null,
        mutator: typeof entry.mutator === 'string' ? entry.mutator : null,
      });
      byId.set(entry.id, list);
    }
  }
  return byId;
}

const byId = declarations(process.argv.slice(2));
const input = readFileSync(0, 'utf8');
const cache = new Map();

for (const row of input.split('\n')) {
  if (row === '') continue;
  const tab = row.lastIndexOf('\t');
  const file = row.slice(0, tab);
  const number = Number(row.slice(tab + 1));
  if (tab < 0 || !Number.isInteger(number) || number < 1) fail(`entrée illisible : ${row}`);
  if (!cache.has(file)) {
    try {
      cache.set(file, readFileSync(file, 'utf8').split('\n'));
    } catch (error) {
      fail(`${file} illisible (${error.message})`);
    }
  }
  const lines = cache.get(file);
  const text = lines[number - 1] ?? '';
  const directive = DIRECTIVE_RE.exec(text);
  if (directive === null) fail(`${file}:${number} : directive illisible`);
  const nextLine = directive[1] !== undefined;
  const mutators = (directive[2] ?? 'all').split(/[\s,]+/).filter((m) => m !== '');
  let last = number + 1;
  if (!nextLine) {
    const restore = lines.findIndex((l, k) => k >= number && RESTORE_RE.test(l));
    last = restore < 0 ? lines.length : restore;
  }
  const where = nextLine ? `la ligne ${number + 1}` : `les lignes ${number + 1} à ${last}`;
  for (const id of new Set(text.match(ID_RE) ?? [])) {
    const declared = byId.get(id);
    if (declared === undefined) continue;
    const match = declared.some(
      (d) =>
        d.file === file &&
        d.line !== null &&
        d.line >= number + 1 &&
        d.line <= last &&
        d.mutator !== null &&
        (mutators.includes('all') || mutators.includes(d.mutator)),
    );
    if (!match && declared.every((d) => d.mutator === null)) {
      process.stdout.write(
        `${file}:${number} : ${id} ne déclare pas son mutateur (champ « mutator » de ` +
          `${declared.map((d) => d.source).join(', ')}), contrôlé contre la directive (mutateur ` +
          `${mutators.join(', ')})\n`,
      );
    } else if (!match) {
      const seen = declared
        .map((d) => `${d.file ?? '?'}:${d.line ?? '?'} ${d.mutator ?? '(mutateur non précisé)'}`)
        .join(', ');
      process.stdout.write(
        `${file}:${number} : ${id} ne désigne pas ce que la directive retire (${where}, ` +
          `mutateur ${mutators.join(', ')}) ; déclaré : ${seen}\n`,
      );
    }
  }
}
