// Formatage des seuls fichiers indexés, au pre-commit (L14-09) : `pnpm format:staged`.
//
// Le contenu vérifié est celui de l'index (`git show :<fichier>`), pas celui de l'arbre de travail :
// un fichier indexé en partie est jugé sur ce qui sera commité. Mêmes règles que
// `prettier --check .` (CLI) : `.prettierrc.json` et `.editorconfig` résolus pour chaque fichier,
// fichiers de `.gitignore` et `.prettierignore` écartés, fichiers sans analyseur Prettier ignorés
// (`--ignore-unknown`). Les suppressions ne sont pas vérifiées, ni les liens symboliques et les
// sous-modules (aucun contenu à formater).
//
// Sortie : 0 si tout est formaté ou si rien n'est indexé ; 1 avec la liste des fichiers sinon.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as prettier from 'prettier';

const git = (args, options = {}) => execFileSync('git', args, { maxBuffer: 1 << 28, ...options });

const root = git(['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

// `--raw -z` : « :<mode src> <mode dst> <sha src> <sha dst> <statut> » NUL <chemin> NUL (ACMR : un
// seul chemin, la destination pour un renommage ou une copie). Mode 100644 ou 100755 : fichier.
const raw = git(['diff', '--cached', '--raw', '-z', '--no-renames', '--diff-filter=ACMR'], {
  cwd: root,
  encoding: 'utf8',
});
const fields = raw.split('\0');
const staged = [];
for (let index = 0; index + 1 < fields.length; index += 2) {
  const mode = fields[index].split(' ')[1];
  if (mode === '100644' || mode === '100755') {
    staged.push(fields[index + 1]);
  }
}

const ignorePath = [resolve(root, '.gitignore'), resolve(root, '.prettierignore')];
const unformatted = [];
for (const file of staged) {
  const filepath = resolve(root, file);
  const info = await prettier.getFileInfo(filepath, { ignorePath, resolveConfig: true });
  // `inferredParser` vaut null pour un fichier ignoré comme pour un type sans analyseur.
  if (info.inferredParser === null) {
    continue;
  }
  const source = git(['show', `:${file}`], { cwd: root, encoding: 'utf8' });
  const options = (await prettier.resolveConfig(filepath, { editorconfig: true })) ?? {};
  if (!(await prettier.check(source, { ...options, filepath }))) {
    unformatted.push(file);
  }
}

if (unformatted.length > 0) {
  process.stderr.write(
    `Formatage Prettier non respecté dans les fichiers indexés :\n${unformatted
      .map((file) => `  ${file}\n`)
      .join('')}Corriger par \`pnpm format\`, puis indexer de nouveau (git add).\n`,
  );
  process.exitCode = 1;
}
