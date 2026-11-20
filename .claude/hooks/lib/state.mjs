// État des garde-fous : dépôts git, instantanés des oracles, autorisations nominatives, journal.
//
// Tout est rangé sous `<projet>/.claude/hooks/` (gitignoré) où `<projet>` est CLAUDE_PROJECT_DIR
// (racine où la session a démarré, fournie par Claude Code) ou, à défaut, la racine git du dossier
// courant : `state/snapshots/<clé>/`, `state/authorizations.json`, `state/violations/`, `audit.log`.
// La clé d'un sous-agent est son agent_id, celle de la session principale son session_id.

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { classify, countMarkers, isOracle } from './policy.mjs';

const JUSTIFICATION_RE = /^Justification-test: \S+ \S/m;

function git(cwd, args, options = {}) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: options.encoding ?? 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Chemin absolu normalisé : liens symboliques résolus sur le plus long préfixe existant. */
export function normalize(path) {
  const abs = resolve(path);
  let existing = abs;
  const tail = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return abs;
    tail.unshift(existing.slice(parent.length + 1));
    existing = parent;
  }
  try {
    return join(realpathSync(existing), ...tail);
  } catch {
    return abs;
  }
}

const toplevelCache = new Map();

/** Racine git qui contient `path` (fichier ou dossier, existant ou non), ou null. */
export function toplevelOf(path) {
  let dir = normalize(path);
  while (!existsSync(dir) || !statSync(dir).isDirectory()) {
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  if (toplevelCache.has(dir)) return toplevelCache.get(dir);
  let top = null;
  try {
    top = normalize(git(dir, ['rev-parse', '--show-toplevel']).trim());
  } catch {
    top = null;
  }
  toplevelCache.set(dir, top);
  return top;
}

/** Chemin relatif POSIX de `abs` dans `top`, ou null s'il en sort. */
export function relativeTo(top, abs) {
  const rel = relative(top, normalize(abs));
  if (rel === '') return '.';
  if (rel.startsWith('..') || resolve(top, rel) !== normalize(abs)) return null;
  return rel.split(sep).join('/');
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function hashFile(path) {
  try {
    return sha256(readFileSync(path));
  } catch {
    return null;
  }
}

/** Fichiers suivis et non suivis (hors .gitignore) d'un dépôt. */
export function listFiles(top) {
  return git(top, ['ls-files', '-z', '-c', '-o', '--exclude-standard'])
    .split('\0')
    .filter((f) => f.length > 0);
}

export function untrackedFiles(top) {
  return git(top, ['ls-files', '-z', '-o', '--exclude-standard'])
    .split('\0')
    .filter((f) => f.length > 0);
}

// ---------------------------------------------------------------------------------------------
// Racine d'état, journal

/**
 * Checkout principal du dépôt qui contient `cwd` (le même pour tous ses worktrees), ou null.
 * `--git-common-dir` sans `--path-format=absolute` (git 2.31) : git 2.30 renvoyait l'option telle
 * quelle sur une ligne, et l'état partait dans un dossier « --path-format=absolute » du worktree.
 * Le chemin rendu est relatif au dossier de la commande (`top`) quand il n'est pas absolu.
 */
export function mainCheckoutOf(cwd) {
  const top = toplevelOf(cwd);
  if (!top) return null;
  try {
    const common = git(top, ['rev-parse', '--git-common-dir']).replace(/\n$/, '');
    if (common === '' || common.includes('\n')) return top;
    return normalize(dirname(resolve(top, common)));
  } catch {
    return top;
  }
}

/**
 * Racine de l'état : CLAUDE_PROJECT_DIR (identique pour tous les hooks d'une session, sous-agents
 * en worktree compris), sinon le checkout principal du dépôt courant (cas d'authorize.mjs lancé
 * depuis un terminal).
 */
export function stateRoot(cwd) {
  const project = process.env.CLAUDE_PROJECT_DIR;
  const root = project && existsSync(project) ? normalize(project) : mainCheckoutOf(cwd);
  if (!root)
    throw new Error("impossible de déterminer la racine du projet pour l'état des garde-fous");
  return join(root, '.claude', 'hooks', 'state');
}

export function auditPath(root) {
  return join(dirname(root), 'audit.log');
}

/** Ajoute une ligne JSON au journal d'audit (jamais d'exception : le journal ne bloque rien). */
export function audit(root, entry) {
  try {
    mkdirSync(dirname(auditPath(root)), { recursive: true });
    appendFileSync(
      auditPath(root),
      `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
    );
  } catch {
    // Le refus ou l'autorisation reste appliqué même si le journal est inaccessible.
  }
}

function writeJsonAtomic(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export function safeKey(key) {
  return key.replace(/[^A-Za-z0-9_.-]/g, '_');
}

// ---------------------------------------------------------------------------------------------
// Instantanés

function snapshotPath(root, key, top) {
  return join(root, 'snapshots', safeKey(key), `${sha256(top).slice(0, 16)}.json`);
}

/** Instantané existant pour (clé, dépôt), ou null. */
export function readSnapshot(root, key, top) {
  return readJson(snapshotPath(root, key, top), null);
}

/**
 * Prend l'instantané des oracles d'un dépôt pour une clé, s'il n'existe pas encore (un instantané
 * n'est jamais écrasé : cela blanchirait une modification). Retourne l'instantané.
 */
export function ensureSnapshot(root, key, top) {
  const existing = readSnapshot(root, key, top);
  if (existing) return existing;
  const files = listFiles(top);
  const oracles = {};
  for (const rel of files) {
    if (isOracle(rel)) oracles[rel] = hashFile(join(top, rel));
  }
  const untracked = {};
  for (const rel of untrackedFiles(top)) untracked[rel] = hashFile(join(top, rel));
  let head = null;
  try {
    head = git(top, ['rev-parse', 'HEAD']).trim();
  } catch {
    head = null;
  }
  const snapshot = { key, top, head, created: new Date().toISOString(), oracles, untracked };
  writeJsonAtomic(snapshotPath(root, key, top), snapshot);
  return snapshot;
}

export function listSnapshots(root, key) {
  const dir = join(root, 'snapshots', safeKey(key));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f), null))
    .filter(Boolean);
}

export function dropSnapshots(root, key) {
  rmSync(join(root, 'snapshots', safeKey(key)), { recursive: true, force: true });
}

/** Supprime l'instantané d'un seul dépôt pour une clé. */
export function dropSnapshot(root, key, top) {
  rmSync(snapshotPath(root, key, top), { force: true });
}

/**
 * Worktrees enregistrés du dépôt du projet (`root` = `<projet>/.claude/hooks/state`). Sortie
 * `--porcelain` sans `-z` : l'option n'existe qu'à partir de git 2.36.
 */
function registeredWorktrees(root) {
  try {
    return git(resolve(root, '..', '..', '..'), ['worktree', 'list', '--porcelain'])
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => normalize(line.slice('worktree '.length)));
  } catch {
    return [];
  }
}

/**
 * État de la racine d'un instantané (BF-11) :
 * - 'ok'      : la racine est toujours le dépôt de l'instantané ;
 * - 'absent'  : le dossier a disparu ;
 * - 'retired' : le dossier existe mais n'est plus ce dépôt (plus de `.git`, ou
 *   `git rev-parse --show-toplevel` différent) et git ne le connaît plus comme worktree : worktree
 *   retiré dont un outil a recréé des fichiers (serveur `nuxt dev` orphelin…) ;
 * - 'broken'  : même symptôme alors que le worktree est toujours enregistré (`.git` retiré à la
 *   main) : signalé, car ce n'est pas un retrait.
 */
export function snapshotRootStatus(root, snapshot) {
  const { top } = snapshot;
  if (!existsSync(top)) return 'absent';
  if (existsSync(join(top, '.git')) && toplevelOf(top) === top) return 'ok';
  return registeredWorktrees(root).includes(top) ? 'broken' : 'retired';
}

// ---------------------------------------------------------------------------------------------
// Autorisations nominatives (créées par authorize.mjs depuis la session principale)

export function authorizationsPath(root) {
  return join(root, 'authorizations.json');
}

export function readAuthorizations(root) {
  const data = readJson(authorizationsPath(root), { grants: [] });
  return Array.isArray(data.grants) ? data.grants : [];
}

export function writeAuthorizations(root, grants) {
  writeJsonAtomic(authorizationsPath(root), { grants });
}

/** Glob simple (`*` dans un segment, `**` sur plusieurs) vers expression régulière. */
export function globToRegExp(glob) {
  let re = '';
  for (let k = 0; k < glob.length; k += 1) {
    const c = glob[k];
    if (c === '*' && glob[k + 1] === '*') {
      re += '.*';
      k += 1;
      if (glob[k + 1] === '/') k += 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function grantActive(g, now) {
  return !g.revoked && Date.parse(g.expires_at) > now;
}

function grantCovers(g, rel) {
  return g.paths.some((p) => globToRegExp(p).test(rel));
}

/**
 * Cherche une autorisation active pour (rôle, clé, portée, chemin). Une autorisation libre est liée
 * à la première clé (agent_id) qui l'utilise : elle devient nominative. `consume` enregistre ce
 * lien ; sans lui, la recherche ne modifie rien.
 */
export function findAuthorization(root, { role, key, scope, rel, consume = false }) {
  const grants = readAuthorizations(root);
  const now = Date.now();
  const grant = grants.find(
    (g) =>
      g.agent === role &&
      g.scope === scope &&
      grantActive(g, now) &&
      (g.bound_to === null || g.bound_to === key) &&
      grantCovers(g, rel),
  );
  if (grant && consume && grant.bound_to === null) {
    grant.bound_to = key;
    writeAuthorizations(root, grants);
  }
  return grant ?? null;
}

/** Autorisation (active ou expirée, non révoquée) déjà liée à cette clé et couvrant le chemin. */
export function usedAuthorization(root, { role, key, scope, rel }) {
  return (
    readAuthorizations(root).find(
      (g) =>
        g.agent === role &&
        g.scope === scope &&
        !g.revoked &&
        g.bound_to === key &&
        grantCovers(g, rel),
    ) ?? findAuthorization(root, { role, key, scope, rel })
  );
}

export function newGrantId() {
  return randomBytes(4).toString('hex');
}

// ---------------------------------------------------------------------------------------------
// Vérification de fin de tâche

/** Contenu d'un fichier à un commit (ou null s'il n'y existe pas). */
function showAt(top, commit, rel) {
  if (!commit) return null;
  try {
    return git(top, ['show', `${commit}:${rel}`]);
  } catch {
    return null;
  }
}

/** Empreinte sha256 d'un fichier à un commit (ou null s'il n'y existe pas). */
function hashAt(top, commit, rel) {
  if (!commit) return null;
  try {
    return sha256(git(top, ['show', `${commit}:${rel}`], { encoding: 'buffer' }));
  } catch {
    return null;
  }
}

/** Fichiers d'un commit (liste vide si le commit est absent ou illisible). */
function filesAt(top, commit) {
  if (!commit) return [];
  try {
    return git(top, ['ls-tree', '-r', '-z', '--name-only', commit])
      .split('\0')
      .filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

/**
 * L14-12 : vrai si `rel` existait quand l'instantané a été pris (oracle relevé, fichier du commit
 * `head` ou fichier non suivi relevé), même si la politique d'alors ne le classait pas oracle : un
 * fichier devenu test depuis (politique élargie par une fusion) est un test existant, pas un
 * nouveau test.
 */
export function existedAtSnapshot(snapshot, rel) {
  if (rel in snapshot.oracles || rel in (snapshot.untracked ?? {})) return true;
  if (!snapshot.head) return false;
  try {
    git(snapshot.top, ['cat-file', '-e', `${snapshot.head}:${rel}`]);
    return true;
  } catch {
    return false;
  }
}

/** Vrai si la modification de `rel` depuis `base` est commitée avec une ligne Justification-test. */
export function committedWithJustification(top, base, rel) {
  if (!base) return false;
  try {
    git(top, ['merge-base', '--is-ancestor', base, 'HEAD']);
  } catch {
    return false;
  }
  const atHead = showAt(top, 'HEAD', rel);
  const onDisk = existsSync(join(top, rel)) ? readFileSync(join(top, rel), 'utf8') : null;
  if (atHead !== onDisk) return false;
  const messages = git(top, ['log', '--format=%B%x00', `${base}..HEAD`, '--', rel]);
  return JUSTIFICATION_RE.test(messages);
}

/**
 * Compare l'état d'un dépôt à son instantané. Retourne la liste des violations :
 * { rel, problem } pour chaque oracle modifié, supprimé ou créé (configuration) sans autorisation
 * ni commit justifié, et pour chaque marqueur ajouté.
 */
export function verifySnapshot(root, snapshot, { role, key }) {
  const { top, head, oracles, untracked } = snapshot;
  const violations = [];
  const status = snapshotRootStatus(root, snapshot);
  if (status === 'absent' || status === 'retired') return violations;
  if (status === 'broken') {
    return [
      {
        rel: '.git',
        problem:
          "la racine de l'instantané n'est plus un dépôt git alors que le worktree reste enregistré " +
          '(retirer le worktree par git worktree remove, ou restaurer son .git)',
      },
    ];
  }

  const allowed = (rel, scope) =>
    usedAuthorization(root, { role, key, scope, rel }) !== null ||
    committedWithJustification(top, head, rel);

  const current = new Set(listFiles(top));
  for (const [rel, before] of Object.entries(oracles)) {
    const now = hashFile(join(top, rel));
    if (now === before) continue;
    const scope = classify(rel) === 'test' ? 'tests' : 'config';
    if (!allowed(rel, scope)) {
      violations.push({ rel, problem: now === null ? 'oracle supprimé' : 'oracle modifié' });
    }
  }
  for (const rel of current) {
    const kind = classify(rel);
    if (kind === null || kind === 'state' || rel in oracles) continue;
    // BF-10 : absent des oracles de l'instantané ne veut pas dire créé. La politique a pu s'élargir
    // depuis (hooks lancés du checkout principal, mis à jour par une fusion) : un fichier qui a le
    // contenu qu'il avait à l'instantané (commit `head`, ou fichier non suivi relevé) est inchangé.
    const now = hashFile(join(top, rel));
    const atHead = hashAt(top, head, rel);
    if (now !== null && (now === atHead || now === untracked[rel])) continue;
    const existed = atHead !== null || rel in untracked;
    if (kind === 'test') {
      // L14-12 : un test créé pendant la tâche est permis ; un fichier devenu test depuis
      // l'instantané, qui existait déjà, est un test existant.
      if (existed && !allowed(rel, 'tests')) violations.push({ rel, problem: 'oracle modifié' });
      continue;
    }
    if (allowed(rel, 'config')) continue;
    violations.push({
      rel,
      problem: existed ? 'oracle modifié' : 'configuration de test ou garde-fou créé',
    });
  }
  // L14-12 : un fichier devenu test depuis l'instantané et supprimé depuis.
  for (const rel of new Set([...filesAt(top, head), ...Object.keys(untracked ?? {})])) {
    if (current.has(rel) || rel in oracles || classify(rel) !== 'test') continue;
    if (!allowed(rel, 'tests')) violations.push({ rel, problem: 'oracle supprimé' });
  }

  // Marqueurs ajoutés dans les fichiers changés depuis l'instantané (commités ou non).
  let changed = [];
  try {
    changed = head ? git(top, ['diff', '--name-only', '-z', head]).split('\0').filter(Boolean) : [];
  } catch {
    changed = [];
  }
  for (const rel of untrackedFiles(top)) {
    if (untracked[rel] !== hashFile(join(top, rel))) changed.push(rel);
  }
  for (const rel of new Set(changed)) {
    const abs = join(top, rel);
    if (!existsSync(abs) || statSync(abs).size > 2 * 1024 * 1024) continue;
    const after = countMarkers(readFileSync(abs, 'utf8'));
    const before = countMarkers(showAt(top, head, rel) ?? '');
    if (after.forbidden > before.forbidden) {
      violations.push({
        rel,
        problem: `marqueur interdit ajouté (${[...after.kinds].join(', ')})`,
      });
    }
    if (after.fails > before.fails && !allowed(rel, 'fails')) {
      violations.push({ rel, problem: 'test en échec attendu ajouté sans autorisation' });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------------------------
// Violations en attente de signalement à l'orchestrateur

export function recordViolations(root, key, role, violations) {
  writeJsonAtomic(join(root, 'violations', `${safeKey(key)}.json`), {
    key,
    role,
    reported: false,
    ts: new Date().toISOString(),
    violations,
  });
}

export function pendingViolations(root) {
  const dir = join(root, 'violations');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: join(dir, f), data: readJson(join(dir, f), null) }))
    .filter((v) => v.data && !v.data.reported);
}

export function markReported(file, data) {
  writeJsonAtomic(file, { ...data, reported: true });
}

export function clearViolations(root, key) {
  rmSync(join(root, 'violations', `${safeKey(key)}.json`), { force: true });
}
