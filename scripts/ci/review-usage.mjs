#!/usr/bin/env node
// Consommation de la revue Claude (L26-06) : résume `total_cost_usd`, `num_turns` et `duration_ms` du résultat
// de l'action (`execution_file`), pour un run (résumé du job) ou une liste de runs (suivi local). Ne lit que
// du JSON (fichier ou entrée standard), n'appelle rien, n'affiche aucun jeton.
//   review-usage.mjs [--pr <n>] [--run <id>] [fichier]   (sans fichier ou « - » : entrée standard)
// Entrées admises :
//   - un fichier d'exécution : tableau de messages (au moins un porte un `type`), dont un message
//     `result` ; le modèle vient du message `system` d'initialisation s'il existe ;
//   - un message `result` seul, ou un objet { run?, pr?, model?, total_cost_usd, num_turns, duration_ms } ;
//   - un tableau de ces objets ou de fichiers d'exécution (un par run).
// Sortie : tableau Markdown et total. Code 0 ; 1 entrée illisible ou valeurs absentes ; 2 usage.
import { readFileSync } from 'node:fs';

const fail = (message, code = 1) => {
  process.stderr.write(`${message}\n`);
  process.exit(code);
};

const args = process.argv.slice(2);
const options = { pr: null, run: null };
let source = '-';
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--pr' || a === '--run') {
    const value = args[i + 1];
    if (value === undefined || !/^\d+$/.test(value)) fail(`usage : ${a} attend un entier`, 2);
    options[a.slice(2)] = value;
    i += 1;
  } else if (a.startsWith('--')) {
    fail('usage : review-usage.mjs [--pr <n>] [--run <id>] [fichier]', 2);
  } else {
    source = a;
  }
}

let data;
try {
  data = JSON.parse(readFileSync(source === '-' ? '/dev/stdin' : source, 'utf8'));
} catch {
  fail('Entrée illisible : du JSON est attendu.');
}

const isExecution = (x) =>
  Array.isArray(x) &&
  x.some((m) => m !== null && typeof m === 'object' && typeof m.type === 'string');

const toEntry = (x) => {
  if (isExecution(x)) {
    const results = x.filter((m) => m && m.type === 'result');
    const init = x.find((m) => m && m.type === 'system' && typeof m.model === 'string');
    return { ...results[results.length - 1], model: init?.model };
  }
  return x;
};

const list = Array.isArray(data) && !isExecution(data) ? data : [data];
const entries = list.map(toEntry).map((e) => ({
  run: e?.run ?? options.run,
  pr: e?.pr ?? options.pr,
  model: e?.model ?? 'inconnu',
  cost: e?.total_cost_usd,
  turns: e?.num_turns,
  duration: e?.duration_ms,
}));
if (entries.length === 0) fail('Aucun run à résumer.');
for (const e of entries) {
  if (![e.cost, e.turns, e.duration].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    fail('Valeurs absentes : total_cost_usd, num_turns et duration_ms sont attendus (nombres).');
  }
}

const cell = (v) => (v === null || v === undefined ? '-' : String(v));
const usd = (v) => v.toFixed(2);
const seconds = (ms) => Math.round(ms / 1000);
const lines = [
  '| Run | PR | Modèle | Coût (USD équivalent) | Tours | Durée (s) |',
  '| --- | --- | --- | ---: | ---: | ---: |',
  ...entries.map(
    (e) =>
      `| ${cell(e.run)} | ${cell(e.pr)} | ${e.model} | ${usd(e.cost)} | ${e.turns} | ${seconds(e.duration)} |`,
  ),
];
if (entries.length > 1) {
  const sum = (key) => entries.reduce((total, e) => total + e[key], 0);
  lines.push(
    `| **Total (${entries.length} runs)** | | | ${usd(sum('cost'))} | ${sum('turns')} | ${seconds(sum('duration'))} |`,
  );
}
process.stdout.write(`${lines.join('\n')}\n`);
