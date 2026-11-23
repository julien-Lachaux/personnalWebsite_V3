#!/usr/bin/env node
// Version et changelog automatiques (lot 23). Aucune dépendance : Node et git seulement, rien d'installé.
//   release.mjs next                     prochaine version (X.Y.Z) d'après les Conventional Commits depuis la
//                                        dernière étiquette v* ; code 1 s'il n'y a rien à publier
//   release.mjs prepare [--commit] [--trailer <ligne>]... [--any-branch]
//                                        met à jour CHANGELOG.md et la version du package.json racine ; refuse
//                                        hors d'une branche release/<version> sauf --any-branch (hotfix)
//   release.mjs check <branche>          concordance branche, version calculée, package.json, CHANGELOG
//   (prepare --commit est toujours refusé sur la branche main, même avec --any-branch)
//   release.mjs notes <version>          section du CHANGELOG de cette version (corps de la release GitHub)
//   release.mjs should-tag               version à étiqueter après un push sur main, ou rien (code 0)
// Environnement : RELEASE_DATE (AAAA-MM-JJ, tests), exécuté à la racine du dépôt.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SECTIONS = [
  ['breaking', 'Changements incompatibles'],
  ['feat', 'Nouveautés'],
  ['fix', 'Corrections'],
  ['perf', 'Performances'],
];
const HEADER = `# Journal des modifications

Fichier généré par \`scripts/ci/release.mjs\` (\`pnpm release:prepare\`) d'après les Conventional Commits :
\`feat\` = version mineure, \`fix\` et \`perf\` = correctif, \`!\` ou \`BREAKING CHANGE\` = version majeure.
Les commits \`docs\`, \`chore\`, \`test\`, \`ci\`, \`build\`, \`refactor\`, \`style\` et de fusion n'y figurent pas.
`;
const FIRST_VERSION = '3.0.0';
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const fail = (message, code = 1) => {
  process.stderr.write(`${message}\n`);
  process.exit(code);
};

const parseVersion = (text) => {
  const m = VERSION_RE.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const compareVersions = (a, b) => {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

// Un commit : { hash, subject, body } -> { type, scope, breaking, description, hash } ou null.
const parseCommit = ({ hash, subject, body }) => {
  const m = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/.exec(subject);
  if (!m) return null;
  const note = /^BREAKING[ -]CHANGE: (.+)$/m.exec(body ?? '');
  return {
    hash: hash.slice(0, 7),
    type: m[1],
    scope: m[2] ?? null,
    breaking: m[3] === '!' || note !== null,
    description: m[4],
    breakingNote: note ? note[1] : null,
  };
};

// Commits à publier (hors chore(release)), vers l'ancien.
const releasable = (commits) =>
  commits
    .map(parseCommit)
    .filter((c) => c !== null && !(c.type === 'chore' && c.scope === 'release'))
    .filter((c) => c.breaking || ['feat', 'fix', 'perf'].includes(c.type));

const bump = (previous, commits) => {
  if (commits.length === 0) return null;
  const [major, minor, patch] = parseVersion(previous);
  if (commits.some((c) => c.breaking)) return `${major + 1}.0.0`;
  if (commits.some((c) => c.type === 'feat')) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const renderSection = (version, date, commits, intro) => {
  const lines = [`## [${version}] - ${date}`, ''];
  if (intro) lines.push(intro, '');
  for (const [key, title] of SECTIONS) {
    const own = commits.filter((c) =>
      key === 'breaking' ? c.breaking : !c.breaking && c.type === key,
    );
    if (own.length === 0) continue;
    lines.push(`### ${title}`, '');
    for (const c of own) {
      const scope = c.scope ? `**${c.scope}** : ` : '';
      const note = key === 'breaking' && c.breakingNote ? ` : ${c.breakingNote}` : '';
      lines.push(`- ${scope}${c.description}${note} (\`${c.hash}\`)`);
    }
    lines.push('');
  }
  return lines.join('\n');
};

// Insère (ou remplace) la section d'une version en tête des sections existantes.
const upsertSection = (changelog, version, section) => {
  const base = changelog === '' ? HEADER : changelog;
  const marker = /^## \[/m;
  const starts = (v) => base.indexOf(`## [${v}] - `);
  const at = starts(version);
  if (at >= 0) {
    const rest = base.slice(at + 3);
    const next = rest.search(marker);
    const end = next < 0 ? base.length : at + 3 + next;
    return `${base.slice(0, at)}${section}\n${base.slice(end)}`.trimEnd() + '\n';
  }
  const first = base.search(marker);
  if (first < 0) return `${base.trimEnd()}\n\n${section}`.trimEnd() + '\n';
  return `${base.slice(0, first)}${section}\n${base.slice(first)}`.trimEnd() + '\n';
};

const extractSection = (changelog, version) => {
  const at = changelog.indexOf(`## [${version}] - `);
  if (at < 0) return null;
  const rest = changelog.slice(at + 3);
  const next = rest.search(/^## \[/m);
  const text = next < 0 ? changelog.slice(at) : changelog.slice(at, at + 3 + next);
  return text.trim();
};

const tags = () =>
  git('tag', '--list', 'v*')
    .split('\n')
    .map((t) => t.replace(/^v/, ''))
    .filter((t) => parseVersion(t) !== null)
    .sort(compareVersions);

const commitsSince = (tag) => {
  const range = tag ? [`v${tag}..HEAD`] : [];
  const out = git('log', '--no-merges', '--format=%H%x1f%s%x1f%b%x1e', ...range);
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.trim() !== '')
    .map((r) => {
      const [hash, subject, body] = r.split('\x1f');
      return { hash, subject, body };
    });
};

// { previous, version, commits, intro } ; version null = rien à publier.
const compute = () => {
  const all = tags();
  const previous = all.length > 0 ? all[all.length - 1] : null;
  if (previous === null) {
    return {
      previous,
      version: FIRST_VERSION,
      commits: [],
      intro: "Première version publiée de la V3 du site ; l'historique complet est dans git.",
    };
  }
  const commits = releasable(commitsSince(previous));
  return { previous, version: bump(previous, commits), commits, intro: null };
};

const readChangelog = () =>
  existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : '';
const packageVersion = () => /"version": "([^"]+)"/.exec(readFileSync('package.json', 'utf8'))?.[1];

const commands = {
  next() {
    const { version } = compute();
    if (version === null)
      fail('Aucun commit feat, fix, perf ou incompatible depuis la dernière étiquette.');
    process.stdout.write(`${version}\n`);
  },
  prepare(args) {
    const { version, commits, intro } = compute();
    if (version === null)
      fail(
        'Rien à publier : aucun commit feat, fix, perf ou incompatible depuis la dernière étiquette.',
      );
    const branch = git('branch', '--show-current');
    // `main` est réservée à Julien : jamais de commit de préparation dessus, même avec --any-branch.
    if (args.includes('--commit') && branch === 'main') {
      fail(
        'prepare --commit refusé sur la branche main : préparer sur release/<version> ou hotfix/*.',
      );
    }
    if (!args.includes('--any-branch') && branch !== `release/${version}`) {
      fail(
        `Branche courante « ${branch} » : la version ${version} se prépare sur release/${version} (ou --any-branch).`,
      );
    }
    const date = process.env.RELEASE_DATE ?? new Date().toISOString().slice(0, 10);
    const section = renderSection(version, date, commits, intro);
    writeFileSync('CHANGELOG.md', upsertSection(readChangelog(), version, section));
    const pkg = readFileSync('package.json', 'utf8').replace(
      /"version": "[^"]+"/,
      `"version": "${version}"`,
    );
    writeFileSync('package.json', pkg);
    if (args.includes('--commit')) {
      const trailers = args.flatMap((a, i) => (args[i - 1] === '--trailer' ? [a] : []));
      git('add', 'CHANGELOG.md', 'package.json');
      const message = [
        `chore(release): ${version}`,
        ...(trailers.length ? ['', ...trailers] : []),
      ].join('\n');
      git('commit', '-m', message);
    }
    process.stdout.write(`${version}\n`);
  },
  check([branch]) {
    const m = /^release\/(\d+\.\d+\.\d+)$/.exec(branch ?? '');
    if (!m) fail(`Branche « ${branch} » : une pull request vers main part de release/<X.Y.Z>.`);
    const [, wanted] = m;
    const { version } = compute();
    if (version === null) fail('Rien à publier depuis la dernière étiquette.');
    const errors = [];
    if (version !== wanted)
      errors.push(
        `la version calculée d'après les commits est ${version}, la branche annonce ${wanted}`,
      );
    if (packageVersion() !== wanted)
      errors.push(`package.json porte ${packageVersion()}, attendu ${wanted}`);
    const section = extractSection(readChangelog(), wanted);
    if (section === null) errors.push(`CHANGELOG.md n'a pas de section [${wanted}]`);
    if (tags().includes(wanted)) errors.push(`l'étiquette v${wanted} existe déjà`);
    if (errors.length > 0)
      fail(
        `Release incohérente :\n- ${errors.join('\n- ')}\nRelancer pnpm release:prepare sur la branche.`,
      );
    process.stdout.write(`Release ${wanted} cohérente.\n`);
  },
  notes([version]) {
    if (parseVersion(version ?? '') === null) fail('usage : release.mjs notes <X.Y.Z>', 2);
    const section = extractSection(readChangelog(), version);
    if (section === null) fail(`Pas de section [${version}] dans CHANGELOG.md.`);
    process.stdout.write(`${section}\n`);
  },
  'should-tag'() {
    const version = packageVersion();
    const all = tags();
    const newest = all.length > 0 ? all[all.length - 1] : null;
    const ok =
      parseVersion(version ?? '') !== null &&
      extractSection(readChangelog(), version) !== null &&
      !all.includes(version) &&
      (newest === null || compareVersions(version, newest) > 0);
    if (ok) process.stdout.write(`${version}\n`);
  },
};

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(commands, command ?? '')) {
  fail('usage : release.mjs next|prepare|check <branche>|notes <version>|should-tag', 2);
}
commands[command](args);
