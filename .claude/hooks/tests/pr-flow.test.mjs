// L20-01 (décision de Julien du 21 nov. 2026, fin des fusions locales) : chaque lot passe par une pull
// request vers develop. La session principale (rôle « main ») ouvre la pull request d'une branche de
// lot (gh pr create --base develop --head lot/<nom>), la commente, la relit, l'édite, la passe en
// prête et la fusionne par commit de merge (gh pr merge --merge lot/<nom>) ; squash, rebase, --admin,
// --delete-branch et --auto lui restent refusés, comme toute autre écriture par gh. Les agents
// spécialisés (les quatorze rôles de .claude/agents, plus revue-pr) ne font que lire. Rejeu par
// l'analyse de la commande (lib/shell.mjs) et, pour un échantillon, par le hook complet (entrée JSON
// de PreToolUse, comme run.sh la transmet) ; gh n'a pas besoin d'être installé, rien n'est exécuté.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeCommand } from '../lib/shell.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AGENTS = join(dirname(HOOKS), 'agents');
// Rôles des fichiers d'agent, plus revue-pr (L20-02) qu'il y ait ou non son fichier.
const ROLES = [
  ...new Set([
    ...readdirSync(AGENTS)
      .filter((f) => f.endsWith('.md'))
      .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]),
    'revue-pr',
  ]),
].sort();

let repo;
let project;

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-pr-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-pr-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  for (const dir of [repo, project]) rmSync(dir, { recursive: true, force: true });
});

/** Motif de refus de l'analyse de la commande (null : permise). */
const denyOf = (command, role) => analyzeCommand(command, repo, role).deny;

/** Hook complet ; `role` « main » : entrée sans agent_type. */
function hook(command, role) {
  const input = {
    session_id: 's-pr',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'test' },
  };
  if (role !== 'main') {
    input.agent_type = role;
    input.agent_id = `id-${role}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

/** Écritures du flux par pull request, permises à la session principale seulement. */
const MAIN_WRITES = [
  'gh pr create --base develop --head lot/20-flux-pr --title "Lot 20 : flux par pull request" --body-file /tmp/pr-lot-20.md',
  `gh pr create --base develop --head lot/20-flux-pr --title "Lot 20" --body "$(cat <<'EOF'\nRésumé du lot.\n\nRecette : à venir.\nEOF\n)"`,
  'gh pr create -B develop -H lot/F6-sections -t "Lot F6" -b "Sections" --draft',
  'gh pr create --base=develop --head=lot/20-flux-pr --fill --label lot --reviewer x',
  'gh pr merge --merge lot/20-flux-pr',
  'gh pr merge -m lot/20-flux-pr',
  'gh pr merge --merge --subject "merge: lot/20-flux-pr (recette acceptée)" lot/20-flux-pr',
  'gh pr merge --merge --match-head-commit 0c79db7 lot/20-flux-pr',
  'gh pr merge --merge -- lot/20-flux-pr',
  'gh pr comment 12 --body "Recette acceptée avec réserves."',
  'gh pr comment lot/20-flux-pr --body-file /tmp/recette.md',
  'gh pr comment 12 --edit-last --body x',
  'gh pr review 12 --comment --body "Recette : voir le compte rendu."',
  'gh pr review 12 --approve',
  'gh pr review 12 --request-changes -b x',
  'gh pr edit 12 --title "Lot 20 (révisé)" --add-label recette',
  'gh pr edit lot/20-flux-pr --base develop',
  'gh pr ready 12',
  'gh pr ready lot/20-flux-pr --undo',
];

/** Lectures permises à toutes les sessions (commandes de suivi d'une pull request). */
const READS = [
  'gh pr view 12',
  'gh pr view lot/20-flux-pr --json state,mergeable,reviewDecision',
  'gh pr view 12 --comments',
  'gh pr checks 12',
  'gh pr checks 12 --watch',
  'gh pr checks lot/20-flux-pr --required',
  'gh pr diff 12',
  'gh pr diff 12 --name-only',
  'gh pr list --base develop --state open',
  'gh pr status',
  'gh run view 99 --log-failed',
  'gh run list --branch lot/20-flux-pr --limit 5',
  'gh run watch 99',
  'gh workflow list',
  'gh workflow view ci.yml',
  'gh api repos/x/y/pulls/12/reviews',
  'gh api repos/x/y/branches/develop/protection',
  'gh repo view',
  'gh release list',
  'gh auth status',
  'gh help pr merge',
  'gh pr',
  'gh --version',
];

/** Échantillon des nouvelles commandes de l'orchestrateur, composées comme il les écrit. */
const ORCHESTRATOR = [
  ...MAIN_WRITES,
  ...READS,
  // Transitoire (L20-01) : la fusion du lot 20 passe encore par develop poussée en local.
  'git push origin develop',
  'git fetch origin && gh pr view 12 --json state',
  'gh pr checks 12 && gh pr merge --merge lot/20-flux-pr',
  'cd .claude/worktrees/lot-20 && gh pr merge --merge lot/20-flux-pr',
  'gh pr merge --merge lot/20-flux-pr && git fetch origin && git switch develop && git pull --ff-only origin develop',
];

/** Refus à la session principale : [commande, motif attendu]. */
const MAIN_REFUSED = [
  // Fusion : commit de merge seulement, branche de lot nommée, protection respectée.
  ['gh pr merge --squash lot/20-flux-pr', /jamais squash/],
  ['gh pr merge -s lot/20-flux-pr', /jamais squash/],
  ['gh pr merge --rebase lot/20-flux-pr', /jamais rebase/],
  ['gh pr merge -r lot/20-flux-pr', /jamais rebase/],
  ['gh pr merge --merge --squash lot/20-flux-pr', /jamais squash/],
  ['gh pr merge --merge --admin lot/20-flux-pr', /contourne la protection/],
  ['gh pr merge --admin --merge lot/20-flux-pr', /contourne la protection/],
  ['gh pr merge --merge --delete-branch lot/20-flux-pr', /supprime la branche distante/],
  ['gh pr merge --merge -d lot/20-flux-pr', /supprime la branche distante/],
  ['gh pr merge -dm lot/20-flux-pr', /supprime la branche distante/],
  ['gh pr merge --merge --auto lot/20-flux-pr', /fusion différée/],
  ['gh pr merge --disable-auto lot/20-flux-pr', /fusion automatique/],
  ['gh pr merge lot/20-flux-pr', /sans --merge/],
  ['gh pr merge 12', /sans --merge/],
  ['gh pr merge', /sans --merge/],
  ['gh pr merge --merge', /branche de lot/],
  ['gh pr merge --merge 12', /branche de lot/],
  ['gh pr merge --merge https://github.com/x/y/pull/12', /branche de lot/],
  ['gh pr merge --merge release/1.0', /branche de lot/],
  ['gh pr merge --merge develop', /branche de lot/],
  ['gh pr merge --merge lot/a lot/b', /plusieurs pull requests/],
  ['gh pr merge --merge=true lot/20-flux-pr', /écris chaque option seule/],
  ['gh pr merge -md lot/20-flux-pr', /écris chaque option seule/],
  ['gh pr merge --merge --unknown lot/20-flux-pr', /option non permise/],
  ['gh pr merge --merge -R x/y lot/20-flux-pr', /autre dépôt/],
  ['gh pr merge --merge --repo=x/y lot/20-flux-pr', /autre dépôt/],
  ['GH_REPO=x/y gh pr merge --merge lot/20-flux-pr', /variable GH_REPO/],
  ['export GH_REPO=x/y; gh pr merge --merge lot/20-flux-pr', /variable GH_REPO/],
  ['GH_HOST=example.invalid gh pr merge --merge lot/20-flux-pr', /variable GH_HOST/],
  ['gh pr merge --merge $BR', /illisible/],
  ['gh pr merge --merge "$(git branch --show-current)"', /illisible/],
  ['echo lot/a | xargs gh pr merge --merge', /entrée standard/],
  ['gh pr --repo x/y merge --merge lot/20-flux-pr', /autre dépôt|en tête/],
  ['gh pr --subject x merge --merge lot/20-flux-pr', /en tête/],
  // Création : base develop et tête lot/* écrites en clair.
  ['gh pr create --head lot/20-flux-pr --title x --body y', /sans --base develop/],
  ['gh pr create --base main --head lot/20-flux-pr', /vise develop/],
  ['gh pr create -B main -H lot/20-flux-pr', /vise develop/],
  ['gh pr create --base=main --head lot/20-flux-pr', /vise develop/],
  ['gh pr create --base develop --base main --head lot/20-flux-pr', /--base répété/],
  ['gh pr create --base develop --title x', /--head lot\/<nom> obligatoire/],
  ['gh pr create --base develop --head develop', /--head lot\/<nom> obligatoire/],
  ['gh pr create --base develop --head x:lot/20-flux-pr', /--head lot\/<nom> obligatoire/],
  ['gh pr create --base develop --head lot/a --head lot/b', /--head lot\/<nom> obligatoire/],
  ['gh pr create --base develop --head lot/20-flux-pr --web', /navigateur/],
  ['gh pr create --base develop --head lot/20-flux-pr --editor', /éditeur/],
  ['gh pr create --base develop --head lot/20-flux-pr --attach a.png', /téléverse/],
  ['gh pr create --base develop --head lot/20-flux-pr extra', /argument non permis/],
  ['gh pr create --base develop --head lot/20-flux-pr -R x/y', /autre dépôt/],
  // Édition, commentaire, relecture.
  ['gh pr edit 12 --base main', /vise develop/],
  ['gh pr edit 12 -B main', /vise develop/],
  ['gh pr edit 12 --add-project x', /projet GitHub/],
  ['gh pr comment 12 --delete-last --yes', /supprime un commentaire/],
  ['gh pr comment 12 --web', /navigateur/],
  ['gh pr review 12 --approve --repo x/y', /autre dépôt/],
  ['gh pr ready 12 13', /plusieurs pull requests/],
  // Toute autre écriture par gh.
  ['gh pr close 12', /ni une lecture ni une écriture du flux/],
  ['gh pr reopen 12', /ni une lecture ni une écriture du flux/],
  ['gh pr checkout 12', /ni une lecture ni une écriture du flux/],
  ['gh pr update-branch 12', /ni une lecture ni une écriture du flux/],
  ['gh co 12', /ni une lecture ni une écriture du flux/],
  ['gh issue create -t x -b y', /ni une lecture ni une écriture du flux/],
  ['gh issue comment 3 --body x', /ni une lecture ni une écriture du flux/],
  ['gh run rerun 99', /ni une lecture ni une écriture du flux/],
  ['gh run download 99', /ni une lecture ni une écriture du flux/],
  ['gh workflow run ci.yml', /ni une lecture ni une écriture du flux/],
  ['gh auth token', /ni une lecture ni une écriture du flux/],
  ['gh auth setup-git', /ni une lecture ni une écriture du flux/],
  ['gh auth logout', /ni une lecture ni une écriture du flux/],
  ['gh secret set X', /ni une lecture ni une écriture du flux/],
  ['gh variable set X --body y', /ni une lecture ni une écriture du flux/],
  ['gh label create x', /ni une lecture ni une écriture du flux/],
  ['gh config set editor vi', /ni une lecture ni une écriture du flux/],
  ['gh extension install x/y', /ni une lecture ni une écriture du flux/],
  ['gh pr constructor', /ni une lecture ni une écriture du flux/],
  ['gh pr --title view comment 12', /en tête/],
  // Déjà refusé (lot 13 bis) et toujours refusé.
  ['gh release create v1.0.0', /réservé à Julien/],
  ['gh repo edit --default-branch main', /réservé à Julien/],
  ['gh api -X PUT repos/x/y/pulls/12/merge', /seule la lecture/],
  ['gh api repos/x/y/pulls/12/merge -f merge_method=squash', /écrit sur GitHub/],
  // Push : forcé, suppression d'une branche distante, main, étiquette.
  ['git push --force origin develop', /push forcé/],
  ['git push origin :lot/20-flux-pr', /supprime une branche distante/],
  ['git push --delete origin lot/20-flux-pr', /suppression d'une branche distante/],
  ['git push origin main', /main est réservée à Julien/],
  ['git push origin develop:main', /main est réservée à Julien/],
  ['git push origin refs/tags/v1.0.0', /étiquettes de version sont réservées/],
];

describe('L20-01 : flux par pull request, session principale', () => {
  it('permet les écritures du flux et les lectures', () => {
    for (const command of ORCHESTRATOR) assert.equal(denyOf(command, 'main'), null, command);
  });

  it('le hook complet laisse passer un échantillon des nouvelles commandes', () => {
    for (const command of [
      MAIN_WRITES[0],
      MAIN_WRITES[1],
      'gh pr merge --merge lot/20-flux-pr',
      'gh pr comment 12 --body x',
      'gh pr review 12 --comment --body x',
      'gh pr checks 12',
      'git push origin develop',
    ]) {
      const r = hook(command, 'main');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });

  for (const [command, reason] of MAIN_REFUSED) {
    it(`refuse ${command}`, () => {
      const deny = denyOf(command, 'main');
      assert.notEqual(deny, null, command);
      assert.match(deny, reason, `${command} : ${deny}`);
    });
  }

  it('le hook complet refuse squash, rebase, --admin, --delete-branch et une base main', () => {
    for (const command of [
      'gh pr merge --squash lot/20-flux-pr',
      'gh pr merge --rebase lot/20-flux-pr',
      'gh pr merge --merge --admin lot/20-flux-pr',
      'gh pr merge --merge --delete-branch lot/20-flux-pr',
      'gh pr create --base main --head lot/20-flux-pr',
      'gh pr edit 12 --base main',
    ]) {
      const r = hook(command, 'main');
      assert.equal(r.code, 2, command);
      assert.match(r.stderr, /Garde-fous : refusé/, command);
    }
  });
});

describe('L20-01 : agents spécialisés, lectures seules', () => {
  it('quinze rôles, revue-pr compris', () => {
    assert.ok(ROLES.includes('revue-pr'));
    assert.ok(ROLES.length >= 15, ROLES.join(', '));
  });

  for (const role of ROLES) {
    it(`refuse au rôle ${role} toute écriture par gh et tout push`, () => {
      for (const command of [
        ...MAIN_WRITES,
        'git push -u origin lot/20-flux-pr',
        'git push origin develop',
      ]) {
        const deny = denyOf(command, role);
        assert.notEqual(deny, null, `${role} : ${command}`);
        assert.match(deny, new RegExp(`rôle ${role}`), `${role} : ${command} : ${deny}`);
        assert.match(deny, /interdit aux agents/, `${role} : ${command} : ${deny}`);
      }
      for (const [command] of MAIN_REFUSED)
        assert.notEqual(denyOf(command, role), null, `${role} : ${command}`);
    });

    it(`laisse lire au rôle ${role}`, () => {
      for (const command of READS)
        assert.equal(denyOf(command, role), null, `${role} : ${command}`);
    });
  }

  it('le hook complet refuse aux agents la création, le commentaire et la fusion', () => {
    for (const role of ['revue-pr', 'revue-code', 'chef-de-projet', 'dev-devops']) {
      for (const command of [
        MAIN_WRITES[0],
        'gh pr comment 12 --body x',
        'gh pr review 12 --comment --body x',
        'gh pr merge --merge lot/20-flux-pr',
      ]) {
        const r = hook(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, /interdit aux agents/, `${role} : ${command}`);
      }
      const read = hook('gh pr diff 12', role);
      assert.equal(read.code, 0, `${role} : ${read.stderr}`);
    }
  });
});
