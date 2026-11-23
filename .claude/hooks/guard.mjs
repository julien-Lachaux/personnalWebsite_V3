#!/usr/bin/env node
// Garde-fous anti-contournement des tests (couche 1), appelés par les hooks de
// .claude/settings.json via run.sh. Un mode par événement :
//
//   pre-tool-use    PreToolUse (Edit, Write, MultiEdit, NotebookEdit, Bash, Monitor) : refuse
//                   (code 2, raison sur stderr) toute écriture d'un oracle ou d'un marqueur ;
//   session-start   SessionStart : instantané des oracles pour la session principale ;
//   subagent-start  SubagentStart : instantané pour le sous-agent et rappel des règles ;
//   verify          Stop et SubagentStop : compare les oracles à l'instantané, refuse la fin de
//                   tâche une fois si l'un a changé sans autorisation ni commit justifié ;
//   report          PostToolUse sur l'outil Agent : signale à l'orchestrateur les violations
//                   laissées par un sous-agent.
//
// Fail-closed : une entrée illisible ou une erreur inattendue en PreToolUse donne un refus.
// Le rôle vient du champ agent_type de l'entrée (nom du frontmatter, fourni par Claude Code) ;
// la session principale, sans agent_type, a le rôle « main ».

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import {
  classify,
  countMarkers,
  countUndeclaredDirectives,
  declaredEquivalentIds,
  hasMarker,
  hasTestSegment,
  roleMayWrite,
  scopeFor,
  startReminder,
  STRYKER_CODE_FILE,
  STRYKER_EQUIVALENTS_FILE,
} from './lib/policy.mjs';
import {
  analyzeCommand,
  hasWritePrimitive,
  pathCandidates,
  ShellParseError,
} from './lib/shell.mjs';
import {
  audit,
  carryCreatedTests,
  clearViolations,
  dropSnapshot,
  dropSnapshots,
  ensureSnapshot,
  existedAtSnapshot,
  findAuthorization,
  globToRegExp,
  listFiles,
  listSnapshots,
  markReported,
  normalize,
  pendingViolations,
  recordAuthorizedWrite,
  recordViolations,
  relativeTo,
  sha256,
  snapshotRootStatus,
  stateRoot,
  toplevelOf,
  verifySnapshot,
} from './lib/state.mjs';

const HONORABLE =
  'Ne contourne pas ce refus. Si le test ou la règle te paraît impossible, contradictoire ou faux, ' +
  'applique la sortie honorable : arrête-toi sur ce point et consigne-le dans ton compte rendu avec ta ' +
  'démonstration (CLAUDE.md, « Agents et garde-fous ») ; l’orchestrateur décidera.';

class InputError extends Error {}
class Denied extends Error {}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseInput(raw) {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new InputError('entrée du hook illisible (JSON invalide)');
  }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new InputError('entrée du hook illisible (objet JSON attendu)');
  }
  return input;
}

function contextOf(input) {
  const role =
    typeof input.agent_type === 'string' && input.agent_type !== '' ? input.agent_type : 'main';
  let key = null;
  if (typeof input.agent_id === 'string' && input.agent_id !== '') key = `agent-${input.agent_id}`;
  else if (typeof input.session_id === 'string' && input.session_id !== '')
    key = `session-${input.session_id}`;
  if (key === null) throw new InputError('entrée du hook sans session_id ni agent_id');
  const cwd = typeof input.cwd === 'string' && isAbsolute(input.cwd) ? input.cwd : process.cwd();
  const scratch =
    typeof input.scratchpad_dir === 'string' && isAbsolute(input.scratchpad_dir)
      ? normalize(input.scratchpad_dir)
      : null;
  return { input, role, key, cwd, scratch, root: stateRoot(cwd), used: [], writes: [] };
}

/** Le dossier temporaire de session est jetable : rien n'y est protégé. */
function inScratch(ctx, abs) {
  return ctx.scratch !== null && (abs === ctx.scratch || abs.startsWith(`${ctx.scratch}/`));
}

function deny(ctx, reason, detail = {}) {
  audit(ctx.root, {
    event: 'deny',
    role: ctx.role,
    key: ctx.key,
    tool: ctx.input.tool_name ?? ctx.input.hook_event_name,
    reason,
    ...detail,
  });
  throw new Denied(reason);
}

/** Exige une autorisation nominative ; la lie à l'agent et la journalise. */
function requireAuthorization(ctx, scope, rel, what) {
  const grant = findAuthorization(ctx.root, {
    role: ctx.role,
    key: ctx.key,
    scope,
    rel,
    consume: true,
  });
  if (!grant) {
    deny(
      ctx,
      `${what} : ${rel}. Aucune autorisation « ${scope} » de l'orchestrateur pour l'agent ${ctx.role}.`,
      {
        path: rel,
      },
    );
  }
  ctx.used.push({ grant: grant.id, ticket: grant.ticket, scope, path: rel });
}

function journalUses(ctx) {
  for (const use of ctx.used) {
    audit(ctx.root, {
      event: 'authorized',
      role: ctx.role,
      key: ctx.key,
      tool: ctx.input.tool_name,
      ...use,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Outils d'édition

function simulateEdit(tool, ti, before) {
  if (tool === 'Write') {
    if (typeof ti.content !== 'string') throw new InputError('Write sans content');
    return ti.content;
  }
  if (tool === 'NotebookEdit') return String(ti.new_source ?? '');
  const edits = tool === 'MultiEdit' ? ti.edits : [ti];
  if (!Array.isArray(edits)) throw new InputError('MultiEdit sans edits');
  let text = before;
  for (const e of edits) {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') {
      throw new InputError(`${tool} sans old_string ou new_string`);
    }
    if (e.old_string === '') text = e.new_string + text;
    else if (!text.includes(e.old_string)) text = `${text}\n${e.new_string}`;
    else if (e.replace_all) text = text.split(e.old_string).join(e.new_string);
    else text = text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

const CODE_FILE = /\.(c|m)?[jt]sx?$|\.(sh|bash|zsh|py|rb|pl)$/;
const STATE_HINT = /\.claude\/hooks\/state|authorizations\.json|\.claude\/hooks\/audit\.log/;
/** Mention de la configuration git dans un code opaque. */
const GIT_CONFIG_HINT =
  /(^|[^\w.])\.git\/(\S+\/)?config\b|\.gitconfig\b|\.config\/git\/config\b|\/etc\/gitconfig\b/;
const GIT_CONFIG = 'la configuration git';
const GIT_CONFIG_MOTIF =
  'elle peut redéfinir la destination des push (remote, url, branche suivie) : réservé à Julien';

/**
 * Fichier de configuration git (T3 du lot 13 bis) : .git/config, config.worktree (dépôt, worktree,
 * sous-module), ~/.gitconfig, $XDG_CONFIG_HOME/git/config, /etc/gitconfig. Personne ne l'édite.
 */
function isGitConfigFile(abs) {
  if (/(^|\/)\.git\/(.+\/)?config(\.worktree)?$/.test(abs)) return true;
  const home = process.env.HOME;
  const xdg = process.env.XDG_CONFIG_HOME || (home ? join(home, '.config') : null);
  return [home && join(home, '.gitconfig'), xdg && join(xdg, 'git', 'config'), '/etc/gitconfig']
    .filter(Boolean)
    .some((file) => abs === file || abs === normalize(file));
}

/** Identifiants des mutants équivalents déclarés dans les stryker.equivalents.json d'un dépôt. */
function declaredEquivalents(top) {
  const ids = new Set();
  for (const rel of listFiles(top)) {
    if (!STRYKER_EQUIVALENTS_FILE.test(rel)) continue;
    try {
      for (const id of declaredEquivalentIds(readFileSync(join(top, rel), 'utf8'))) ids.add(id);
    } catch {
      // Fichier illisible : ses identifiants ne comptent pas comme déclarés.
    }
  }
  return ids;
}

const DIRECTIVE_MOTIF =
  'une directive Stryker disable cite l’identifiant (<PAQUET>-EQ-<n>) d’un mutant équivalent déjà ' +
  'déclaré dans un stryker.equivalents.json, sous autorisation et Justification-test (CLAUDE.md, ' +
  '« Conventions de code »)';

function checkFileTool(ctx, tool, ti) {
  const filePath = ti.file_path ?? ti.notebook_path;
  if (typeof filePath !== 'string' || filePath === '')
    throw new InputError(`${tool} sans file_path`);
  const abs = normalize(isAbsolute(filePath) ? filePath : resolve(ctx.cwd, filePath));
  if (isGitConfigFile(abs))
    deny(ctx, `la configuration git (${abs}) ne s'édite pas : ${GIT_CONFIG_MOTIF}`, { path: abs });
  if (inScratch(ctx, abs)) return;

  const before = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  const after = simulateEdit(tool, ti, before);
  const top = toplevelOf(abs);
  const rel = top ? relativeTo(top, abs) : null;
  const snapshot = top ? ensureSnapshot(ctx.root, ctx.key, top) : null;

  const mb = countMarkers(before);
  const ma = countMarkers(after);
  if (ma.forbidden > mb.forbidden) {
    deny(
      ctx,
      `marqueur de saut, de focus ou commentaire d'ignore de couverture (${[...ma.kinds].join(', ')}) dans ${rel ?? abs}`,
      {
        path: rel ?? abs,
      },
    );
  }
  if (ma.fails > mb.fails) {
    if (rel === null) deny(ctx, `test en échec attendu hors dépôt : ${abs}`);
    requireAuthorization(ctx, 'fails', rel, 'test en échec attendu (marqueur fails)');
  }
  if (rel === null) return;
  // L14-01 : une directive Stryker disable qui ne cite pas un équivalent déclaré est refusée dès
  // l'écriture, comme un marqueur de saut (le script d'intégrité la refuse au commit et en CI).
  if (STRYKER_CODE_FILE.test(rel) && /Stryker\s+disable/.test(after)) {
    const declared = declaredEquivalents(top);
    if (countUndeclaredDirectives(after, declared) > countUndeclaredDirectives(before, declared))
      deny(
        ctx,
        `directive Stryker disable sans équivalent déclaré dans ${rel} : ${DIRECTIVE_MOTIF}`,
        {
          path: rel,
        },
      );
  }

  const kind = classify(rel);
  if (kind === 'state')
    deny(ctx, `l'état des garde-fous ne s'écrit pas à la main : ${rel}`, { path: rel });
  if (!roleMayWrite(ctx.role, rel)) {
    deny(ctx, `le rôle ${ctx.role} n'écrit pas ce chemin : ${rel} (voir son fichier d'agent)`, {
      path: rel,
    });
  }
  if (kind === 'guard' || kind === 'config') {
    requireAuthorization(ctx, 'config', rel, 'configuration de test, de CI ou garde-fou');
  } else if (kind === 'test') {
    // L14-12 : un fichier devenu test en cours de session (politique élargie depuis l'instantané)
    // est un test existant s'il existait à l'instantané, même hors de ses oracles.
    const existing = snapshot ? existedAtSnapshot(snapshot, rel) : existsSync(abs);
    if (existing) requireAuthorization(ctx, 'tests', rel, 'modification d’un test existant');
  }
  if (
    ctx.role !== 'main' &&
    CODE_FILE.test(rel) &&
    STATE_HINT.test(after) &&
    !STATE_HINT.test(before)
  ) {
    deny(ctx, `un fichier de code qui vise l'état des garde-fous n'est pas permis : ${rel}`, {
      path: rel,
    });
  }
  // L25-04 : empreinte exacte du contenu que l'écriture autorisée produira, pour que la fin de
  // tâche d'une autre clé qui a photographié ce dépôt ne la lui attribue pas.
  const exact = exactContent(tool, ti, before);
  if (exact !== null) {
    for (const use of ctx.used.filter((u) => u.path === rel))
      ctx.writes.push({ top, rel, sha256: sha256(exact), grant: use.grant, scope: use.scope });
  }
}

/**
 * Contenu que l'outil écrira, s'il est exactement connu : Write ; Edit et MultiEdit dont chaque
 * texte remplacé est présent (une seule fois sans replace_all). Sinon null : l'outil échouera ou
 * normalisera, et rien n'est relevé.
 */
function exactContent(tool, ti, before) {
  if (tool === 'Write') return typeof ti.content === 'string' ? ti.content : null;
  if (tool !== 'Edit' && tool !== 'MultiEdit') return null;
  const edits = tool === 'MultiEdit' ? ti.edits : [ti];
  if (!Array.isArray(edits)) return null;
  let text = before;
  for (const e of edits) {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') return null;
    if (e.old_string === '') return null;
    const count = text.split(e.old_string).length - 1;
    if (count === 0 || (count > 1 && !e.replace_all)) return null;
    text = e.replace_all
      ? text.split(e.old_string).join(e.new_string)
      : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

// ---------------------------------------------------------------------------------------------
// Shell

/** Classe une cible d'écriture shell et applique la règle correspondante. */
function checkShellTarget(ctx, abs, raw) {
  if (isGitConfigFile(abs))
    deny(ctx, `écriture shell de la configuration git (${raw}) : ${GIT_CONFIG_MOTIF}`, {
      path: abs,
    });
  if (inScratch(ctx, abs)) return;
  const top = toplevelOf(abs);
  if (!top) return;
  const snapshot = ensureSnapshot(ctx.root, ctx.key, top);
  const rel = relativeTo(top, abs);
  if (rel === null) return;
  const oracles = Object.keys(snapshot.oracles);

  if (/[*?[]/.test(rel)) {
    const re = globToRegExp(rel);
    const hit = oracles.find((o) => re.test(o));
    if (hit)
      deny(ctx, `écriture shell sur un motif qui couvre un oracle (${raw} couvre ${hit})`, {
        path: rel,
      });
    return;
  }
  const kind = classify(rel);
  if (kind === 'state')
    deny(ctx, `l'état des garde-fous ne s'écrit pas à la main : ${rel}`, { path: rel });
  const zone =
    rel === '.' ||
    oracles.some((o) => o.startsWith(`${rel}/`)) ||
    (!existsSync(abs) && (hasTestSegment(rel) || raw.endsWith('/')) && kind === null);
  if (zone) {
    deny(
      ctx,
      `écriture shell sur un dossier qui contient des oracles (${raw}) : vise un fichier précis, hors tests`,
      {
        path: rel,
      },
    );
  }
  if (!roleMayWrite(ctx.role, rel)) {
    deny(ctx, `le rôle ${ctx.role} n'écrit pas ce chemin : ${rel}`, { path: rel });
  }
  const scope = scopeFor(kind);
  if (scope === 'config')
    requireAuthorization(
      ctx,
      'config',
      rel,
      'écriture shell sur une configuration de test ou un garde-fou',
    );
  if (scope === 'tests' && existedAtSnapshot(snapshot, rel)) {
    requireAuthorization(ctx, 'tests', rel, 'écriture shell sur un test existant');
  }
}

/** Recherche, dans un code opaque, un chemin qui désigne un oracle ou l'état des garde-fous. */
function opaqueHit(ctx, text, base) {
  if (GIT_CONFIG_HINT.test(text)) return GIT_CONFIG;
  if (ctx.role !== 'main' && STATE_HINT.test(text)) return "l'état des garde-fous";
  const tops = [toplevelOf(base), toplevelOf(ctx.cwd)].filter(Boolean);
  for (const cand of pathCandidates(text)) {
    for (const top of new Set(tops)) {
      const snapshot = ensureSnapshot(ctx.root, ctx.key, top);
      const oracles = Object.keys(snapshot.oracles);
      for (const abs of [resolve(base, cand), resolve(top, cand)]) {
        const rel = relativeTo(top, abs);
        if (rel === null || rel === '.') continue;
        if (/[*?[]/.test(rel)) {
          const re = globToRegExp(rel);
          if (oracles.some((o) => re.test(o) || re.test(o.split('/').pop()))) return cand;
          continue;
        }
        const kind = classify(rel);
        if (kind === 'state' || kind === 'guard' || kind === 'config') return cand;
        if (rel in snapshot.oracles || oracles.some((o) => o.startsWith(`${rel}/`))) return cand;
      }
    }
  }
  return null;
}

function checkShell(ctx, ti) {
  const command = ti.command;
  if (typeof command !== 'string') throw new InputError('commande shell absente');
  let analysis;
  try {
    analysis = analyzeCommand(command, ctx.cwd, ctx.role, { scratch: ctx.scratch });
  } catch (error) {
    if (error instanceof ShellParseError) deny(ctx, `commande illisible (${error.message})`);
    throw error;
  }
  if (analysis.deny) deny(ctx, analysis.deny);

  const cwdTop = toplevelOf(ctx.cwd);
  if (cwdTop) ensureSnapshot(ctx.root, ctx.key, cwdTop);

  if (analysis.writes && hasMarker(command)) {
    deny(
      ctx,
      "écriture shell d'un marqueur de saut, de focus ou d'un commentaire d'ignore : utilise l'outil Write, qui le refusera aussi sauf autorisation",
    );
  }
  // L14-01 : directive Stryker disable écrite par le shell dans un fichier de code (ou par une
  // écriture opaque, dont la cible n'est pas lisible) sans équivalent déclaré.
  if (
    analysis.writes &&
    /Stryker\s+disable/.test(command) &&
    (analysis.opaque.length > 0 ||
      [...analysis.targets, ...analysis.repoTargets].some((t) => STRYKER_CODE_FILE.test(t.path)))
  ) {
    const declared = cwdTop ? declaredEquivalents(cwdTop) : new Set();
    if (countUndeclaredDirectives(command, declared, { loose: true }) > 0)
      deny(
        ctx,
        `écriture shell d'une directive Stryker disable sans équivalent déclaré : ${DIRECTIVE_MOTIF}`,
      );
  }

  let guardScript = false;
  for (const s of analysis.scripts) {
    const abs = normalize(resolve(s.base, s.path));
    const top = toplevelOf(abs);
    const rel = top ? relativeTo(top, abs) : null;
    if ((rel && /^\.claude\/hooks\//.test(rel)) || /(^|\/)\.claude\/hooks\//.test(s.path)) {
      if (ctx.role !== 'main')
        deny(
          ctx,
          `les scripts des garde-fous ne se lancent que depuis la session principale (${s.path})`,
        );
      guardScript = true;
    }
  }

  for (const t of analysis.targets)
    checkShellTarget(ctx, normalize(resolve(t.base, t.path)), t.path);
  for (const t of analysis.repoTargets) {
    const top = toplevelOf(t.base) ?? t.base;
    checkShellTarget(ctx, normalize(resolve(top, t.path)), t.path);
  }

  if (!guardScript) {
    for (const o of analysis.opaque) {
      const always =
        o.what.startsWith('xargs') || ['find', 'patch', 'git apply', 'git am'].includes(o.what);
      if (!always && !hasWritePrimitive(o.text)) continue;
      const hit = opaqueHit(ctx, o.text, o.base);
      if (hit === GIT_CONFIG)
        deny(
          ctx,
          `écriture opaque (${o.what}) qui vise la configuration git : ${GIT_CONFIG_MOTIF}`,
        );
      if (hit) {
        deny(
          ctx,
          `écriture opaque (${o.what}) qui mentionne un oracle (${hit}) : impossible de vérifier ce qu'elle modifie`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Modes

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'Monitor', 'PowerShell']);

function preToolUse(ctx) {
  const { tool_name: tool, tool_input: ti } = ctx.input;
  if (typeof tool !== 'string' || ti === null || typeof ti !== 'object') {
    throw new InputError('entrée PreToolUse sans tool_name ou tool_input');
  }
  if (FILE_TOOLS.has(tool)) checkFileTool(ctx, tool, ti);
  else if (SHELL_TOOLS.has(tool) || typeof ti.command === 'string') checkShell(ctx, ti);
  journalUses(ctx);
  for (const w of ctx.writes)
    recordAuthorizedWrite(ctx.root, { ...w, key: ctx.key, role: ctx.role });
}

function snapshotCwd(ctx) {
  const top = toplevelOf(ctx.cwd);
  if (top) ensureSnapshot(ctx.root, ctx.key, top);
}

function verify(ctx) {
  // BF-11 : l'instantané d'une racine disparue ou d'un worktree retiré (dossier recréé par un outil,
  // qui n'est plus ce dépôt) est ignoré et supprimé, sans attendre que les autres soient propres.
  const snapshots = listSnapshots(ctx.root, ctx.key).filter((s) => {
    const status = snapshotRootStatus(ctx.root, s);
    if (status !== 'absent' && status !== 'retired') return true;
    dropSnapshot(ctx.root, ctx.key, s.top);
    return false;
  });
  const violations = snapshots.flatMap((s) =>
    verifySnapshot(ctx.root, s, { role: ctx.role, key: ctx.key }).map((v) => ({
      ...v,
      top: s.top,
    })),
  );
  if (violations.length === 0) {
    // L25-03 : les tests créés pendant la tâche restent libres si la même clé reprend (agent
    // relancé par un message, nouveau tour de la session principale).
    for (const s of snapshots) carryCreatedTests(ctx.root, ctx.key, s);
    dropSnapshots(ctx.root, ctx.key);
    clearViolations(ctx.root, ctx.key);
    return 0;
  }
  recordViolations(ctx.root, ctx.key, ctx.role, violations);
  audit(ctx.root, { event: 'violation', role: ctx.role, key: ctx.key, violations });
  if (ctx.input.stop_hook_active === true) {
    // Déjà relancé une fois : on laisse finir, la violation reste consignée et sera signalée à
    // l'orchestrateur (mode report) ; la CI la refusera si elle est commitée.
    return 0;
  }
  const lines = violations.map((v) => `  - ${v.rel} : ${v.problem}`).join('\n');
  process.stderr.write(
    `Garde-fous : fin de tâche refusée, des oracles ont changé depuis ton démarrage sans autorisation ni commit justifié :\n${lines}\n` +
      "N'essaie pas de masquer le changement. Décris dans ton compte rendu ce que tu as modifié et pourquoi " +
      '(sortie honorable) ; l’orchestrateur restaurera les fichiers ou décidera. La violation lui est signalée.\n',
  );
  return 2;
}

function report(ctx) {
  if (ctx.role !== 'main') return;
  const pending = pendingViolations(ctx.root);
  if (pending.length === 0) return;
  const text = pending
    .map(({ data }) => {
      const list = data.violations
        .map((v) => `${v.rel} (${v.problem}, dépôt ${v.top})`)
        .join(' ; ');
      return `agent ${data.role} [${data.key}] : ${list}`;
    })
    .join('\n');
  for (const { file, data } of pending) markReported(file, data);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `Garde-fous : oracles modifiés sans autorisation ni commit justifié.\n${text}\n` +
          'Ne pas fusionner en l’état : restaurer ces fichiers ou faire trancher (journal : .claude/hooks/audit.log).',
      },
    }),
  );
}

function main() {
  const mode = process.argv[2];
  let ctx = null;
  try {
    ctx = contextOf(parseInput(readStdin()));
    switch (mode) {
      case 'pre-tool-use':
        preToolUse(ctx);
        return 0;
      case 'session-start':
        snapshotCwd(ctx);
        return 0;
      case 'subagent-start':
        snapshotCwd(ctx);
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'SubagentStart',
              additionalContext: startReminder(ctx.role),
            },
          }),
        );
        return 0;
      case 'verify':
        return verify(ctx);
      case 'report':
        report(ctx);
        return 0;
      default:
        throw new InputError(`mode inconnu : ${mode ?? '(aucun)'}`);
    }
  } catch (error) {
    if (error instanceof Denied) {
      process.stderr.write(`Garde-fous : refusé. ${error.message}\n${HONORABLE}\n`);
      return 2;
    }
    const message =
      error instanceof InputError ? error.message : `erreur interne (${error?.message ?? error})`;
    if (ctx) audit(ctx.root, { event: 'error', mode, role: ctx.role, key: ctx.key, message });
    if (mode === 'report' || mode === 'session-start' || mode === 'subagent-start') {
      process.stderr.write(`Garde-fous (${mode}) : ${message}\n`);
      return 1;
    }
    process.stderr.write(`Garde-fous : refusé par prudence, ${message}.\n`);
    return 2;
  }
}

process.exitCode = main();
