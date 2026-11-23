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
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
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

/**
 * Écriture atomique (fichier temporaire puis rename). L26-05 : l'élagage retire les dossiers
 * devenus vides (`carry/<clé>/`, `authorized-writes/<dépôt>/`) ; s'il en retire un entre la
 * création du dossier et le rename, l'écriture recommence (ENOENT), trois fois au plus.
 */
function writeJsonAtomic(path, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  for (let attempt = 1; ; attempt += 1) {
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(tmp, text);
      renameSync(tmp, path);
      return;
    } catch (error) {
      rmSync(tmp, { force: true });
      if (error?.code !== 'ENOENT' || attempt >= 3) throw error;
    }
  }
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
 * L25-03 : tests créés pendant la tâche d'une clé, reportés par sa fin de tâche réussie
 * (`state/carry/<clé>/<dépôt>.json`) vers son prochain instantané du même dépôt (agent repris).
 */
function carryPath(root, key, top) {
  return join(root, 'carry', safeKey(key), `${sha256(top).slice(0, 16)}.json`);
}

/**
 * Prend l'instantané des oracles d'un dépôt pour une clé, s'il n'existe pas encore (un instantané
 * n'est jamais écrasé : cela blanchirait une modification). Retourne l'instantané.
 * L25-03 : les tests que la même clé a créés lors d'une tâche précédente (report de sa fin de
 * tâche réussie) et qui n'ont pas changé depuis sont relevés dans `carried`, hors des oracles et
 * des fichiers non suivis : ils restent des tests créés pendant la tâche. Le report est consommé.
 */
export function ensureSnapshot(root, key, top) {
  const existing = readSnapshot(root, key, top);
  if (existing) return existing;
  const carry = readJson(carryPath(root, key, top), null);
  const carried = {};
  if (carry && carry.key === key && carry.top === top && carry.tests) {
    for (const [rel, hash] of Object.entries(carry.tests)) {
      if (classify(rel) === 'test' && hash !== null && hashFile(join(top, rel)) === hash)
        carried[rel] = hash;
    }
  }
  const files = listFiles(top);
  const oracles = {};
  for (const rel of files) {
    if (isOracle(rel) && !(rel in carried)) oracles[rel] = hashFile(join(top, rel));
  }
  const untracked = {};
  for (const rel of untrackedFiles(top)) {
    if (!(rel in carried)) untracked[rel] = hashFile(join(top, rel));
  }
  let head = null;
  try {
    head = git(top, ['rev-parse', 'HEAD']).trim();
  } catch {
    head = null;
  }
  const snapshot = {
    key,
    top,
    head,
    created: new Date().toISOString(),
    oracles,
    untracked,
    carried,
  };
  writeJsonAtomic(snapshotPath(root, key, top), snapshot);
  rmSync(carryPath(root, key, top), { force: true });
  return snapshot;
}

/**
 * L25-03 : tests présents dans le dépôt qui n'existaient pas à l'instantané (créés pendant la
 * tâche, ou reportés d'une tâche précédente de la même clé), avec leur empreinte.
 */
export function createdTests(snapshot) {
  const created = {};
  for (const rel of listFiles(snapshot.top)) {
    if (classify(rel) !== 'test' || existedAtSnapshot(snapshot, rel)) continue;
    const hash = hashFile(join(snapshot.top, rel));
    if (hash !== null) created[rel] = hash;
  }
  return created;
}

/**
 * L25-03 : en fin de tâche réussie, avant la suppression de l'instantané, reporte les tests créés
 * pendant la tâche vers le prochain instantané de la même clé et du même dépôt (agent repris par
 * un message, nouveau tour de la session principale). Seule cette clé en profite, et seulement
 * pour un fichier resté identique.
 */
export function carryCreatedTests(root, key, snapshot) {
  const tests = createdTests(snapshot);
  const path = carryPath(root, key, snapshot.top);
  if (Object.keys(tests).length === 0) rmSync(path, { force: true });
  else writeJsonAtomic(path, { key, top: snapshot.top, ts: new Date().toISOString(), tests });
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
// Écritures autorisées (L25-04) : empreinte exacte du contenu produit par un Edit, MultiEdit ou
// Write qu'une autorisation a permis, relevée par le hook PreToolUse. La fin de tâche d'une autre
// clé n'alerte pas pour un oracle dont le contenu actuel est exactement celui-là.
// L26-05 : un fichier JSON par écriture, `state/authorized-writes/<dépôt>/<horodatage>-….json`
// (`<dépôt>` = 16 premiers caractères du sha256 de la racine), écrit de façon atomique et jamais
// réécrit : l'élagage le supprime sans verrou ni risque de perdre une écriture concurrente, et une
// vérification ne lit que les écritures de son dépôt. L'ancien journal `authorized-writes.jsonl`
// (lot 25) reste lu tant que l'élagage ne l'a pas converti.

function authorizedWritesDir(root) {
  return join(root, 'authorized-writes');
}

function legacyAuthorizedWritesPath(root) {
  return join(root, 'authorized-writes.jsonl');
}

function repoDirName(top) {
  return sha256(top).slice(0, 16);
}

function listDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Relevé lisible : tous les champs que la vérification compare. */
function validWrite(w) {
  return (
    w !== null &&
    typeof w === 'object' &&
    ['top', 'rel', 'sha256', 'key', 'grant', 'scope', 'ts'].every(
      (field) => typeof w[field] === 'string',
    ) &&
    Number.isFinite(Date.parse(w.ts))
  );
}

/** Relevés lisibles d'un texte JSON Lines (ancien format) : [{ line, w }]. */
function parseWriteLines(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (line === '') continue;
    try {
      const w = JSON.parse(line);
      if (validWrite(w)) out.push({ line, w });
    } catch {
      // Ligne illisible (ou en cours d'écriture par un hook du lot 25) : ignorée.
    }
  }
  return out;
}

/**
 * Relève une écriture autorisée : { top, rel, sha256, key, role, grant, scope }. Jamais
 * d'exception : sans relevé, la fin de tâche d'une autre clé alerte, comme avant L25-04.
 */
export function recordAuthorizedWrite(root, entry) {
  try {
    const name = `${Date.now()}-${process.pid}-${randomBytes(4).toString('hex')}.json`;
    writeJsonAtomic(join(authorizedWritesDir(root), repoDirName(entry.top), name), {
      ts: new Date().toISOString(),
      ...entry,
    });
  } catch {
    // L'écriture reste autorisée ; seule l'attribution à cet agent sera impossible.
  }
}

/** Écritures autorisées relevées pour un dépôt, de la plus récente à la plus ancienne. */
export function readAuthorizedWrites(root, top) {
  const out = [];
  const dir = join(authorizedWritesDir(root), repoDirName(top));
  for (const file of listDir(dir)) {
    if (!file.endsWith('.json')) continue;
    const w = readJson(join(dir, file), null);
    if (validWrite(w) && w.top === top) out.push(w);
  }
  try {
    const legacy = readFileSync(legacyAuthorizedWritesPath(root), 'utf8');
    for (const { w } of parseWriteLines(legacy)) if (w.top === top) out.push(w);
  } catch {
    // Pas d'ancien journal : cas normal depuis sa conversion.
  }
  return out.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

/**
 * Écriture autorisée d'une AUTRE clé que `key` qui a produit exactement le contenu `hash` de `rel`
 * dans `top`, depuis `since` (création de l'instantané vérifié), pour la portée `scope`, sous une
 * autorisation toujours connue, liée à cette clé et non révoquée ; ou null.
 */
export function authorizedWriteBy(root, { top, rel, hash, key, scope, since }) {
  const writes = readAuthorizedWrites(root, top);
  if (writes.length === 0) return null;
  const grants = readAuthorizations(root);
  const from = Date.parse(since);
  for (const w of writes) {
    if (
      w.top !== top ||
      w.rel !== rel ||
      w.sha256 !== hash ||
      w.key === key ||
      w.scope !== scope ||
      !(Date.parse(w.ts) >= from)
    )
      continue;
    const grant = grants.find((g) => g.id === w.grant);
    if (grant && !grant.revoked && grant.bound_to === w.key && grantCovers(grant, rel)) return w;
  }
  return null;
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
  // L25-03 : test créé par la même clé lors d'une tâche précédente, inchangé depuis.
  if (rel in (snapshot.carried ?? {})) return false;
  if (rel in snapshot.oracles || rel in (snapshot.untracked ?? {})) return true;
  if (!snapshot.head) return false;
  try {
    git(snapshot.top, ['cat-file', '-e', `${snapshot.head}:${rel}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Vrai si la modification de `rel` depuis `base` (tête de l'instantané) est commitée avec une ligne
 * Justification-test : contenu du disque identique à HEAD, et un commit de `base..HEAD` qui touche
 * `rel` porte la ligne (même règle que scripts/ci/check-tests-integrity.sh). Si l'historique a été
 * réécrit depuis l'instantané (`base` n'est plus ancêtre de HEAD), voir justifiedAfterRewrite.
 */
export function committedWithJustification(top, base, rel) {
  if (!base) return false;
  const atHead = showAt(top, 'HEAD', rel);
  const onDisk = existsSync(join(top, rel)) ? readFileSync(join(top, rel), 'utf8') : null;
  if (atHead !== onDisk) return false;
  try {
    git(top, ['merge-base', '--is-ancestor', base, 'HEAD']);
  } catch {
    return justifiedAfterRewrite(top, base, rel);
  }
  const messages = git(top, ['log', '--format=%B%x00', `${base}..HEAD`, '--', rel]);
  return JUSTIFICATION_RE.test(messages);
}

/**
 * L25-02 (L19-06) : historique réécrit depuis l'instantané (`git reset` puis de nouveaux commits,
 * rebase : `base` n'est plus ancêtre de HEAD). Les commits de HEAD non atteignables depuis la base
 * commune (`git merge-base base HEAD`) sont ceux de la branche réécrite. Le fichier n'est accepté
 * que si son contenu à HEAD (identique au disque, vérifié par l'appelant) est exactement celui
 * qu'un de ces commits, portant une ligne Justification-test, lui a donné : un commit non justifié
 * qui le change ensuite, un commit justifié de l'historique abandonné ou d'avant la base commune ne
 * comptent pas. Un fichier supprimé est accepté si un de ces commits justifiés l'a supprimé. Sans
 * base commune (historique sans lien, tête de l'instantané disparue) : refus.
 */
function justifiedAfterRewrite(top, base, rel) {
  let fork;
  let log;
  try {
    fork = git(top, ['merge-base', base, 'HEAD']).trim();
    log = git(top, ['log', '--full-history', '--format=%H%x00%B%x00', `${fork}..HEAD`, '--', rel]);
  } catch {
    return false;
  }
  const target = hashAt(top, 'HEAD', rel);
  const parts = log.split('\0');
  for (let k = 0; k + 1 < parts.length; k += 2) {
    if (JUSTIFICATION_RE.test(parts[k + 1]) && hashAt(top, parts[k].trim(), rel) === target)
      return true;
  }
  return false;
}

/**
 * Compare l'état d'un dépôt à son instantané. Retourne la liste des violations :
 * { rel, problem } pour chaque oracle modifié, supprimé ou créé (configuration) sans autorisation
 * ni commit justifié, et pour chaque marqueur ajouté.
 */
export function verifySnapshot(root, snapshot, { role, key }) {
  const { top, head, oracles, untracked } = snapshot;
  const carried = snapshot.carried ?? {};
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

  // L25-04 : contenu actuel exactement produit par l'écriture autorisée d'une autre clé depuis
  // l'instantané (un fichier supprimé n'a pas de contenu : jamais couvert). L'attribution est
  // journalisée ; la fin de tâche de l'agent autorisé reste vérifiée par sa propre autorisation.
  const byOther = (rel, scope) => {
    const now = hashFile(join(top, rel));
    if (now === null) return false;
    const w = authorizedWriteBy(root, { top, rel, hash: now, key, scope, since: snapshot.created });
    if (w === null) return false;
    audit(root, {
      event: 'attributed',
      role,
      key,
      rel,
      top,
      by: w.key,
      by_role: w.role,
      grant: w.grant,
      scope,
    });
    return true;
  };
  const allowed = (rel, scope) =>
    usedAuthorization(root, { role, key, scope, rel }) !== null ||
    committedWithJustification(top, head, rel) ||
    byOther(rel, scope);

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
    // L25-03 : un test reporté d'une tâche précédente de la même clé est un test créé.
    const existed = (atHead !== null || rel in untracked) && !(rel in carried);
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
    if (current.has(rel) || rel in oracles || rel in carried || classify(rel) !== 'test') continue;
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
