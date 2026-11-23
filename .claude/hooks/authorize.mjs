#!/usr/bin/env node
// Autorisations nominatives des garde-fous : exception contrôlée et auditée (couche 1).
//
// Lancé par l'orchestrateur (session principale) ou par Julien dans un terminal, jamais par un
// sous-agent : le hook PreToolUse refuse l'exécution des scripts de .claude/hooks/ quand l'entrée
// porte un agent_type. Chaque autorisation vise un rôle (agent_type), une portée, un identifiant
// de finding ou de ticket, des chemins précis, et expire. Elle est liée au premier sous-agent qui
// l'utilise (agent_id) et ne sert qu'à lui. Création, révocation et chaque usage sont journalisés
// dans .claude/hooks/audit.log ; aucune variable d'environnement n'ouvre d'exception.
//
//   node .claude/hooks/authorize.mjs grant --agent correcteur --scope tests --ticket RC-12 \
//        --reason "test faux établi par le triage" --path apps/api/test/errors.e2e-spec.ts [--ttl 240]
//   node .claude/hooks/authorize.mjs list
//   node .claude/hooks/authorize.mjs revoke --id <identifiant>

import { classify, GRANTABLE } from './lib/policy.mjs';
import {
  audit,
  newGrantId,
  readAuthorizations,
  stateRoot,
  writeAuthorizations,
} from './lib/state.mjs';

const USAGE =
  'usage : authorize.mjs grant --agent <rôle> --scope <tests|fails|config> --ticket <id> --reason <texte> ' +
  '--path <chemin relatif> [--path …] [--ttl <minutes, 240 par défaut, 1440 au plus>]\n' +
  '        authorize.mjs list\n' +
  '        authorize.mjs revoke --id <identifiant>';

function fail(message) {
  process.stderr.write(`authorize : ${message}\n${USAGE}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { path: [] };
  for (let k = 0; k < argv.length; k += 1) {
    const a = argv[k];
    if (!a.startsWith('--')) fail(`argument inattendu : ${a}`);
    const name = a.slice(2);
    const value = argv[k + 1];
    if (value === undefined || value.startsWith('--')) fail(`valeur manquante pour ${a}`);
    if (name === 'path') out.path.push(value);
    else out[name] = value;
    k += 1;
  }
  return out;
}

function grant(root, args) {
  const { agent, scope, ticket, reason } = args;
  if (!GRANTABLE[scope]) fail(`portée inconnue : ${scope ?? '(absente)'}`);
  if (!GRANTABLE[scope].includes(agent)) {
    fail(`la portée « ${scope} » ne s'accorde qu'à : ${GRANTABLE[scope].join(', ')}`);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(ticket ?? ''))
    fail('--ticket attendu (identifiant du finding ou du ticket)');
  if (!reason || reason.trim().length < 5) fail('--reason attendu (raison lisible)');
  if (args.path.length === 0) fail('au moins un --path attendu');
  for (const p of args.path) {
    if (p.startsWith('/') || p.split('/').includes('..'))
      fail(`chemin relatif à la racine du dépôt attendu : ${p}`);
    const kind = classify(p.replace(/\*+/g, 'x'));
    if (kind === 'state') fail(`l'état des garde-fous ne s'autorise pas : ${p}`);
    if ((scope === 'tests' || scope === 'fails') && kind !== 'test')
      fail(`${p} n'est pas un fichier de test`);
    if (scope === 'config' && kind !== 'config' && kind !== 'guard')
      fail(`${p} n'est pas une configuration protégée`);
  }
  const ttl = args.ttl === undefined ? 240 : Number(args.ttl);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1440) fail('--ttl : entier de 1 à 1440 minutes');
  const now = Date.now();
  const entry = {
    id: newGrantId(),
    agent,
    scope,
    ticket,
    reason: reason.trim(),
    paths: args.path,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl * 60_000).toISOString(),
    bound_to: null,
    revoked: false,
  };
  writeAuthorizations(root, [...readAuthorizations(root), entry]);
  audit(root, { event: 'grant', ...entry });
  process.stdout.write(
    `autorisation ${entry.id} : ${agent}, ${scope}, ${ticket}, jusqu'à ${entry.expires_at}\n`,
  );
}

function list(root) {
  const now = Date.now();
  for (const g of readAuthorizations(root)) {
    const state = g.revoked ? 'révoquée' : Date.parse(g.expires_at) <= now ? 'expirée' : 'active';
    process.stdout.write(
      `${g.id} ${state} ${g.agent} ${g.scope} ${g.ticket} ${g.paths.join(',')} lié=${g.bound_to ?? '-'} fin=${g.expires_at}\n`,
    );
  }
}

function revoke(root, args) {
  const grants = readAuthorizations(root);
  const g = grants.find((x) => x.id === args.id);
  if (!g) fail(`autorisation inconnue : ${args.id ?? '(absente)'}`);
  // L26-05 : la date de révocation borne la conservation des écritures relevées sous elle.
  if (!g.revoked) g.revoked_at = new Date().toISOString();
  g.revoked = true;
  writeAuthorizations(root, grants);
  audit(root, { event: 'revoke', id: g.id, agent: g.agent, ticket: g.ticket });
  process.stdout.write(`autorisation ${g.id} révoquée\n`);
}

const [command, ...rest] = process.argv.slice(2);
const root = stateRoot(process.cwd());
if (command === 'grant') grant(root, parseArgs(rest));
else if (command === 'list') list(root);
else if (command === 'revoke') revoke(root, parseArgs(rest));
else fail(`commande inconnue : ${command ?? '(aucune)'}`);
