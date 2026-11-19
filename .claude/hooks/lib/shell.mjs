// Analyse « au mieux » d'une commande shell : découpe en segments, repère les cibles d'écriture
// (redirections, rm, mv, cp, tee, sed -i, perl -i, dd, git checkout/restore/rm/mv, find -delete…),
// les écritures opaques (interpréteurs avec code en ligne ou script, xargs, git apply, patch) et
// les commandes toujours interdites (git push, --no-verify, core.hooksPath…).
//
// Ce n'est pas un interpréteur bash complet : le hook de fin (comparaison des empreintes) et le
// script d'intégrité de la CI sont les filets pour ce qui échappe à cette analyse.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

/** Erreur de lecture d'une commande (guillemet non refermé…) : le hook refuse (fail-closed). */
export class ShellParseError extends Error {}

function newSegment() {
  return { words: [], redirects: [], heredoc: '' };
}

/**
 * Découpe la commande en segments séparés par ; && || | & ( ) `…` $( et les fins de ligne.
 * Chaque segment porte ses mots (guillemets retirés), les cibles de ses redirections en écriture
 * et le corps de ses here-documents.
 */
export function parseShell(command) {
  const segments = [];
  let seg = newSegment();
  let word = null;
  let pending = null; // 'redirect' | 'skip' | { heredoc: strip }
  const heredocs = [];
  const n = command.length;
  let i = 0;

  const pushWord = () => {
    if (word === null) return;
    if (pending === 'redirect') seg.redirects.push(word);
    else if (pending && typeof pending === 'object')
      heredocs.push({ delim: word, seg, strip: pending.heredoc });
    else if (pending !== 'skip') seg.words.push(word);
    pending = null;
    word = null;
  };
  const endSegment = () => {
    pushWord();
    if (seg.words.length > 0 || seg.redirects.length > 0) segments.push(seg);
    seg = newSegment();
  };
  const readHeredocBodies = () => {
    while (heredocs.length > 0 && i < n) {
      const h = heredocs.shift();
      let body = '';
      while (i < n) {
        const end = command.indexOf('\n', i);
        const line = command.slice(i, end < 0 ? n : end);
        i = end < 0 ? n : end + 1;
        const compared = h.strip ? line.replace(/^\t+/, '') : line;
        if (compared === h.delim) break;
        body += `${line}\n`;
      }
      h.seg.heredoc += body;
    }
  };

  while (i < n) {
    const c = command[i];
    const next = command[i + 1];
    if (c === '\\') {
      if (next === '\n') {
        i += 2;
        continue;
      }
      word = (word ?? '') + (next ?? '');
      i += 2;
      continue;
    }
    if (c === "'") {
      const j = command.indexOf("'", i + 1);
      if (j < 0) throw new ShellParseError('apostrophe non refermée');
      word = (word ?? '') + command.slice(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === '$' && next === "'") {
      let j = i + 2;
      let out = '';
      while (j < n && command[j] !== "'") {
        if (command[j] === '\\' && j + 1 < n) {
          out += command[j + 1];
          j += 2;
        } else {
          out += command[j];
          j += 1;
        }
      }
      if (j >= n) throw new ShellParseError("chaîne $'…' non refermée");
      word = (word ?? '') + out;
      i = j + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let out = '';
      while (j < n && command[j] !== '"') {
        if (command[j] === '\\' && '"\\$`\n'.includes(command[j + 1] ?? '')) {
          out += command[j + 1];
          j += 2;
        } else {
          out += command[j];
          j += 1;
        }
      }
      if (j >= n) throw new ShellParseError('guillemet non refermé');
      word = (word ?? '') + out;
      i = j + 1;
      continue;
    }
    if (c === '#' && word === null) {
      const end = command.indexOf('\n', i);
      i = end < 0 ? n : end;
      continue;
    }
    if (c === '\n') {
      endSegment();
      i += 1;
      readHeredocBodies();
      continue;
    }
    if (c === ' ' || c === '\t') {
      pushWord();
      i += 1;
      continue;
    }
    if (c === '`' || c === ';' || c === '(' || c === ')') {
      endSegment();
      i += 1;
      continue;
    }
    if (c === '$' && next === '(') {
      endSegment();
      i += 2;
      continue;
    }
    if (c === '|') {
      endSegment();
      i += next === '|' || next === '&' ? 2 : 1;
      continue;
    }
    if (c === '&') {
      if (next === '>') {
        pushWord();
        i += command[i + 2] === '>' ? 3 : 2;
        pending = 'redirect';
        continue;
      }
      endSegment();
      i += next === '&' ? 2 : 1;
      continue;
    }
    if (c === '<' || c === '>') {
      // Un mot entièrement numérique collé à la redirection est un descripteur (2>…).
      if (word !== null && /^\d+$/.test(word)) word = null;
      else pushWord();
      if (c === '<') {
        if (next === '<' && command[i + 2] === '<') {
          i += 3;
          pending = 'skip';
        } else if (next === '<') {
          i += 2;
          let strip = false;
          if (command[i] === '-') {
            strip = true;
            i += 1;
          }
          pending = { heredoc: strip };
        } else if (next === '>') {
          i += 2;
          pending = 'redirect';
        } else {
          i += 1;
          pending = 'skip';
        }
        continue;
      }
      i += 1;
      if (command[i] === '>' || command[i] === '|') i += 1;
      if (command[i] === '&') {
        // >&2, 2>&1, >&- : duplication de descripteur, pas une écriture de fichier.
        let j = i + 1;
        while (j < n && /[^\s;&|<>()]/.test(command[j])) j += 1;
        const dup = command.slice(i + 1, j);
        if (!/^(\d+|-)$/.test(dup)) seg.redirects.push(dup);
        i = j;
        continue;
      }
      pending = 'redirect';
      continue;
    }
    word = (word ?? '') + c;
    i += 1;
  }
  endSegment();
  return segments;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SIMPLE_WRAPPERS = new Set([
  'command',
  'builtin',
  'exec',
  'nohup',
  'time',
  'noglob',
  'chronic',
  'unbuffer',
]);
const OPTION_WRAPPERS = {
  sudo: new Set(['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U']),
  doas: new Set(['-u', '-C']),
  env: new Set(['-u', '-C', '-S', '--unset', '--chdir']),
  nice: new Set(['-n', '--adjustment']),
  stdbuf: new Set(['-i', '-o', '-e']),
  timeout: new Set(['-k', '-s', '--kill-after', '--signal']),
  ionice: new Set(['-c', '-n', '-p']),
  setsid: new Set([]),
  flock: new Set(['-w', '-E']),
  watch: new Set(['-n', '-d']),
};
const XARGS_WRITERS = new Set([
  'rm',
  'rmdir',
  'unlink',
  'shred',
  'truncate',
  'touch',
  'chmod',
  'chown',
  'mv',
  'cp',
  'install',
  'ln',
  'tee',
  'dd',
  'sed',
  'gsed',
  'perl',
  'ruby',
  'awk',
  'gawk',
  'git',
  'patch',
]);
const XARGS_VALUE_OPTIONS = new Set([
  '-I',
  '-i',
  '-n',
  '-P',
  '-d',
  '-L',
  '-s',
  '-a',
  '-E',
  '-e',
  '--arg-file',
  '--delimiter',
]);

/** Retire affectations de variables et enveloppes (sudo, env, timeout, xargs…) en tête de segment. */
function unwrap(words) {
  let w = [...words];
  let viaXargs = false;
  const assignments = [];
  for (let guard = 0; guard < 20 && w.length > 0; guard += 1) {
    if (ASSIGNMENT.test(w[0])) {
      assignments.push(w.shift());
      continue;
    }
    const name = basename(w[0]);
    if (SIMPLE_WRAPPERS.has(name)) {
      w.shift();
      if (name === 'time' && w[0] === '-p') w.shift();
      continue;
    }
    if (name === 'xargs') {
      viaXargs = true;
      w.shift();
      while (w.length > 0 && w[0].startsWith('-')) {
        const opt = w.shift();
        if (XARGS_VALUE_OPTIONS.has(opt)) w.shift();
      }
      continue;
    }
    if (OPTION_WRAPPERS[name]) {
      const valued = OPTION_WRAPPERS[name];
      w.shift();
      while (w.length > 0 && (w[0].startsWith('-') || (name === 'env' && ASSIGNMENT.test(w[0])))) {
        const opt = w.shift();
        if (ASSIGNMENT.test(opt)) assignments.push(opt);
        else if (valued.has(opt)) w.shift();
      }
      if (name === 'timeout' && w.length > 0) w.shift(); // durée
      continue;
    }
    break;
  }
  return { words: w, viaXargs, assignments };
}

/** Arguments qui ne sont pas des options ; `valued` liste les options suivies d'une valeur. */
function operands(args, valued = new Set()) {
  const out = [];
  let endOfOptions = false;
  for (let k = 0; k < args.length; k += 1) {
    const a = args[k];
    if (endOfOptions) {
      out.push(a);
    } else if (a === '--') {
      endOfOptions = true;
    } else if (a.startsWith('-') && a !== '-') {
      if (valued.has(a)) k += 1;
    } else {
      out.push(a);
    }
  }
  return out;
}

function valueOf(args, names) {
  const out = [];
  for (let k = 0; k < args.length; k += 1) {
    const a = args[k];
    for (const name of names) {
      if (a === name && k + 1 < args.length) out.push(args[k + 1]);
      else if (name.startsWith('--') && a.startsWith(`${name}=`))
        out.push(a.slice(name.length + 1));
    }
  }
  return out;
}

const INTERPRETERS = new Set([
  'python',
  'python2',
  'python3',
  'node',
  'nodejs',
  'deno',
  'bun',
  'ruby',
  'perl',
  'php',
  'tsx',
  'ts-node',
  'bash',
  'sh',
  'zsh',
  'dash',
  'ksh',
  'fish',
  'pwsh',
  'osascript',
  'eval',
  'source',
  '.',
]);
const INLINE_FLAGS = new Set(['-c', '-e', '-E', '-p', '-r', '--eval', '--print', '-x']);
/** Primitives d'écriture repérées dans un code opaque (script, code en ligne, here-document). */
const WRITE_PRIMITIVES =
  /writeFile|appendFile|createWriteStream|copyFile|cpSync|renameSync|\brename\(|unlink|rmSync|rmdir|truncate|\.write\(|write_text|write_bytes|shutil\.|os\.remove|os\.replace|open\([^)]*['"][wax+]|execSync|execFile|spawn|child_process|subprocess|system\(|\bsed\s+-i|\btee\b|>\s*[^\s&]|\bgit\s+(checkout|restore|rm|mv|apply|update-index)\b|\b(rm|mv|cp)\s/;

function readSmallFile(path) {
  try {
    if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size > 512 * 1024)
      return '';
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** Chemins modifiés par un patch unifié (lignes --- a/ et +++ b/). */
export function patchPaths(text) {
  const out = new Set();
  for (const m of text.matchAll(/^(?:\+\+\+|---) (?:[ab]\/)?(\S+)/gm)) {
    if (m[1] !== '/dev/null') out.add(m[1]);
  }
  return [...out];
}

/**
 * Analyse une commande. `cwd` est le dossier courant de l'agent (entrée du hook).
 * Résultat :
 * - deny      : raison d'un refus inconditionnel (ou null) ;
 * - targets   : [{ path, base }] cibles d'écriture explicites, à classer par l'appelant ;
 * - repoTargets : [{ path, base }] chemins relatifs à la racine du dépôt (patch git) ;
 * - opaque    : [{ what, text, base }] écritures dont la cible n'est pas lisible ;
 * - scripts   : [{ path, base }] scripts exécutés (pour repérer les scripts des garde-fous) ;
 * - writes    : vrai si la commande écrit quelque chose (pour les marqueurs dans le texte).
 */
export function analyzeCommand(command, cwd) {
  const result = {
    deny: null,
    targets: [],
    repoTargets: [],
    opaque: [],
    scripts: [],
    writes: false,
  };
  const segments = parseShell(command);
  let base = cwd;
  const target = (path, b = base) => {
    result.targets.push({ path, base: b });
    result.writes = true;
  };
  const opaque = (what, text, b = base) => {
    result.opaque.push({ what, text, base: b });
    result.writes = true;
  };

  for (const seg of segments) {
    for (const r of seg.redirects) {
      if (r !== '/dev/null' && r !== '/dev/stdout' && r !== '/dev/stderr') target(r);
    }
    const { words, viaXargs, assignments } = unwrap(seg.words);
    if (assignments.some((a) => /^HUSKY=0$/.test(a))) {
      result.deny = 'désactiver husky (HUSKY=0) est interdit';
    }
    if (words.length === 0) continue;
    const cmd = basename(words[0]);
    const args = words.slice(1);

    if (viaXargs && (XARGS_WRITERS.has(cmd) || INTERPRETERS.has(cmd))) {
      // Les arguments viennent de l'entrée standard : la cible est illisible.
      opaque(`xargs ${cmd}`, command);
    }
    if (
      args.includes('--update') ||
      (args.includes('-u') && /vitest|^test/.test(words.join(' ')))
    ) {
      result.deny = 'mettre à jour les instantanés de test (vitest -u) affaiblit un oracle';
    }

    switch (cmd) {
      case 'cd':
      case 'pushd':
        if (args[0] && args[0] !== '-') base = resolve(base, args[0]);
        break;
      case 'rm':
      case 'rmdir':
      case 'unlink':
      case 'shred':
      case 'touch':
        operands(args, new Set(['-r', '-d', '-t', '--reference'])).forEach((p) => target(p));
        break;
      case 'truncate':
        operands(args, new Set(['-s', '--size', '-r', '--reference'])).forEach((p) => target(p));
        break;
      case 'chmod':
      case 'chown':
      case 'chgrp':
        operands(args, new Set(['--reference']))
          .slice(1)
          .forEach((p) => target(p));
        break;
      case 'mv':
        operands(args, new Set(['-t', '--target-directory', '-S', '--suffix'])).forEach((p) =>
          target(p),
        );
        valueOf(args, ['-t', '--target-directory']).forEach((p) => target(p));
        break;
      case 'cp':
      case 'install':
      case 'ln':
      case 'rsync':
      case 'scp': {
        const ops = operands(
          args,
          new Set(['-t', '--target-directory', '-m', '--mode', '-o', '-g', '-S', '-e']),
        );
        const dirs = valueOf(args, ['-t', '--target-directory']);
        if (dirs.length > 0) dirs.forEach((p) => target(p));
        else if (ops.length >= 2) target(ops[ops.length - 1]);
        else if (ops.length === 1 && cmd === 'ln') target(ops[0]);
        break;
      }
      case 'tee':
        operands(args).forEach((p) => target(p));
        break;
      case 'dd':
        args.filter((a) => a.startsWith('of=')).forEach((a) => target(a.slice(3)));
        break;
      case 'sed':
      case 'gsed': {
        const inPlace = args.some((a) => /^-[^-]*i/.test(a) || a.startsWith('--in-place'));
        if (inPlace) {
          const hasScriptOption = args.some((a) =>
            ['-e', '-f', '--expression', '--file'].includes(a),
          );
          const ops = operands(
            args,
            new Set(['-e', '-f', '--expression', '--file', '-l', '--line-length']),
          );
          (hasScriptOption ? ops : ops.slice(1)).forEach((p) => target(p));
        }
        break;
      }
      case 'perl':
      case 'ruby': {
        const inPlace = args.some((a) => /^-[a-zA-Z0-9]*i/.test(a));
        const hasInline = args.some((a) => /^-[a-zA-Z0-9]*[eE]$/.test(a));
        const ops = operands(args, new Set(['-e', '-E', '-M', '-I', '-m', '-r']));
        if (inPlace) (hasInline ? ops : ops.slice(1)).forEach((p) => target(p));
        if (hasInline) opaque(cmd, `${args.join(' ')}\n${seg.heredoc}`);
        else if (!inPlace && ops[0]) {
          result.scripts.push({ path: ops[0], base });
          opaque(cmd, readSmallFile(resolve(base, ops[0])));
        } else if (!inPlace) opaque(cmd, seg.heredoc);
        break;
      }
      case 'awk':
      case 'gawk': {
        const inPlace = args.some(
          (a, k) => (a === '-i' && args[k + 1] === 'inplace') || a === '--include=inplace',
        );
        if (inPlace) {
          const hasFile = args.includes('-f');
          const ops = operands(args, new Set(['-i', '-f', '-v', '-F', '--include']));
          (hasFile ? ops : ops.slice(1)).forEach((p) => target(p));
        }
        break;
      }
      case 'ed':
      case 'ex':
      case 'vi':
      case 'vim':
      case 'nvim':
      case 'nano':
      case 'emacs':
        operands(args, new Set(['-c', '-s', '-u'])).forEach((p) => target(p));
        break;
      case 'curl':
        valueOf(args, ['-o', '--output']).forEach((p) => target(p));
        if (args.includes('-O') || args.includes('--remote-name')) target('.');
        break;
      case 'wget':
        valueOf(args, ['-O', '--output-document', '-P', '--directory-prefix']).forEach((p) =>
          target(p),
        );
        break;
      case 'tar':
      case 'bsdtar': {
        const extract = args.some(
          (a) => a === '--extract' || a === '--get' || /^-?[a-zA-Z]*x/.test(a),
        );
        if (extract) {
          const dirs = valueOf(args, ['-C', '--directory']);
          (dirs.length > 0 ? dirs : ['.']).forEach((p) => target(p));
        }
        break;
      }
      case 'unzip': {
        const dirs = valueOf(args, ['-d']);
        (dirs.length > 0 ? dirs : ['.']).forEach((p) => target(p));
        break;
      }
      case 'find': {
        const acting = args.some((a) =>
          [
            '-delete',
            '-exec',
            '-execdir',
            '-ok',
            '-okdir',
            '-fprint',
            '-fprint0',
            '-fprintf',
            '-fls',
          ].includes(a),
        );
        if (acting) {
          const roots = [];
          for (const a of args) {
            if (a.startsWith('-') || a === '(' || a === '!') break;
            roots.push(a);
          }
          (roots.length > 0 ? roots : ['.']).forEach((p) => target(p));
          opaque('find', args.join(' '));
        }
        break;
      }
      case 'patch': {
        const files = valueOf(args, ['-i', '--input']);
        const text = files.map((f) => readSmallFile(resolve(base, f))).join('\n') + seg.heredoc;
        if (text.trim() === '') opaque('patch', command);
        patchPaths(text).forEach((p) => target(p));
        operands(args, new Set(['-i', '--input', '-p', '-d', '-o', '--output', '-r'])).forEach(
          (p) => target(p),
        );
        break;
      }
      case 'git':
        analyzeGit(args, base, result, target, opaque, seg);
        break;
      case 'docker':
        if (args[0] === 'cp' && args.length >= 3) {
          const dest = args[args.length - 1];
          if (!/^[\w.-]+:/.test(dest)) target(dest);
        }
        break;
      default:
        if (INTERPRETERS.has(cmd)) {
          const inline = args.some((a) => INLINE_FLAGS.has(a) || /^-[a-zA-Z]*[ce]$/.test(a));
          const ops = operands(
            args,
            new Set(['-m', '-W', '-X', '-r', '--require', '--import', '--loader', '-I', '-M']),
          );
          if (inline || cmd === 'eval') {
            opaque(cmd, `${args.join(' ')}\n${seg.heredoc}`);
          } else if (ops.length > 0 && ops[0] !== '-') {
            result.scripts.push({ path: ops[0], base });
            opaque(cmd, `${readSmallFile(resolve(base, ops[0]))}\n${seg.heredoc}`);
          } else {
            opaque(cmd, seg.heredoc || command);
          }
        }
    }
  }
  return result;
}

const GIT_GLOBAL_VALUED = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
]);

function analyzeGit(args, base, result, target, opaque, seg) {
  let gitBase = base;
  let k = 0;
  for (; k < args.length; k += 1) {
    const a = args[k];
    if (a === '-C' && args[k + 1]) {
      gitBase = resolve(gitBase, args[k + 1]);
      k += 1;
    } else if (a === '-c' && args[k + 1]) {
      if (/^core\.hookspath=/i.test(args[k + 1]))
        result.deny = 'changer core.hooksPath désactive le hook pre-commit';
      k += 1;
    } else if (GIT_GLOBAL_VALUED.has(a)) {
      k += 1;
    } else if (!a.startsWith('-')) {
      break;
    }
  }
  const sub = args[k];
  const rest = args.slice(k + 1);
  const t = (p) => target(p, gitBase);
  switch (sub) {
    case 'push':
      result.deny = 'git push est interdit à tous les agents';
      break;
    case 'commit': {
      for (let j = 0; j < rest.length; j += 1) {
        const a = rest[j];
        if (a === '--no-verify') result.deny = 'git commit --no-verify est interdit';
        else if (/^-[a-zA-Z]+$/.test(a) && a.includes('n'))
          result.deny = 'git commit -n (sans hook) est interdit';
        if (
          [
            '-m',
            '-F',
            '-C',
            '-c',
            '-t',
            '--author',
            '--date',
            '--fixup',
            '--squash',
            '--trailer',
          ].includes(a) ||
          /^-[a-zA-Z]*[mFCct]$/.test(a)
        )
          j += 1;
      }
      break;
    }
    case 'config':
      if (rest.some((a) => /^core\.hookspath$/i.test(a)))
        result.deny = 'changer core.hooksPath désactive le hook pre-commit';
      break;
    case 'update-index':
      if (rest.some((a) => ['--assume-unchanged', '--skip-worktree'].includes(a))) {
        result.deny =
          'masquer une modification à git (assume-unchanged, skip-worktree) est interdit';
      }
      break;
    case 'filter-branch':
    case 'filter-repo':
    case 'replace':
      result.deny = "la réécriture de l'historique est réservée à Julien";
      break;
    case 'stash':
      if (rest.length === 0)
        result.deny = 'git stash nu est interdit (CLAUDE.md) : git stash push -u -m <étiquette>';
      break;
    case 'checkout': {
      const dash = rest.indexOf('--');
      if (dash >= 0) rest.slice(dash + 1).forEach(t);
      else {
        const ops = operands(
          rest,
          new Set(['-b', '-B', '--orphan', '--conflict', '--pathspec-from-file']),
        );
        const paths = ops.filter(
          (p) => p === '.' || /[*?[]/.test(p) || existsSync(resolve(gitBase, p)),
        );
        if (ops.length > 1 || paths.length === ops.length) paths.forEach(t);
      }
      if (rest.some((a) => a.startsWith('--pathspec-from-file')))
        opaque('git checkout', rest.join(' '), gitBase);
      break;
    }
    case 'restore':
      operands(rest, new Set(['-s', '--source'])).forEach(t);
      if (rest.some((a) => a.startsWith('--pathspec-from-file')))
        opaque('git restore', rest.join(' '), gitBase);
      break;
    case 'rm':
    case 'mv':
      operands(rest).forEach(t);
      break;
    case 'reset': {
      const dash = rest.indexOf('--');
      if (dash >= 0) rest.slice(dash + 1).forEach(t);
      const ops = operands(dash >= 0 ? rest.slice(0, dash) : rest);
      if (
        rest.some((a) => ['--hard', '--merge', '--keep'].includes(a)) &&
        ops.some((o) => !/^HEAD$/.test(o))
      )
        t('.');
      break;
    }
    case 'apply':
    case 'am': {
      const files = operands(rest, new Set(['-p', '-C', '--directory', '--exclude', '--include']));
      const text = files.map((f) => readSmallFile(resolve(gitBase, f))).join('\n') + seg.heredoc;
      if (text.trim() === '') opaque(`git ${sub}`, rest.join(' '), gitBase);
      for (const p of patchPaths(text)) {
        result.repoTargets.push({ path: p, base: gitBase });
        result.writes = true;
      }
      break;
    }
    default:
      break;
  }
}

/** Vrai si un code opaque contient une primitive d'écriture. */
export function hasWritePrimitive(text) {
  return WRITE_PRIMITIVES.test(text);
}

/** Candidats « chemins » d'un texte libre (script, code en ligne) pour la recherche d'oracles. */
export function pathCandidates(text) {
  const out = new Set();
  for (const m of text.matchAll(/[A-Za-z0-9_@.*\-/]+/g)) {
    const s = m[0].replace(/^\.\//, '');
    if (s.length > 2 && (s.includes('/') || /\.[a-z]{2,5}$/i.test(s))) out.add(s);
  }
  return [...out];
}
