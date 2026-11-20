// Politique des garde-fous : ce qui est un « oracle », quels marqueurs sont interdits, ce que
// chaque rôle peut écrire. Aucune dépendance : modules Node intégrés seulement.
//
// Les motifs portent sur des chemins RELATIFS à la racine du dépôt git concerné (worktree
// compris), au format POSIX.
//
// Attention : ce fichier ne doit contenir aucun marqueur littéral (les expressions régulières
// ci-dessous sont écrites sous forme d'alternatives pour ne pas se détecter elles-mêmes).

/** Fichiers de test : un fichier EXISTANT de cette catégorie ne se modifie pas. */
const TEST_PATTERNS = [
  // `.e2e` : parcours Playwright du front (apps/web/test/**/*.e2e.ts, lot F0).
  /(^|\/)[^/]+\.(spec|e2e-spec|test|e2e)\.[cm]?[jt]sx?$/,
  /(^|\/)[^/]+\.test\.sh$/,
  /(^|\/)[^/]+\.fixtures?\.[cm]?[jt]sx?$/,
  /(^|\/)(test|tests|__tests__|fixtures|__fixtures__|__snapshots__)\//,
  /\.snap$/,
  // Captures attendues de Playwright (`toHaveScreenshot`, dossier `<fichier de test>-snapshots/`).
  /(^|\/)[^/]+-snapshots\//,
];

/**
 * Captures de référence du handoff de design (régression visuelle du front, D7 de docs/05) : un
 * oracle de la classe « test », que personne ne crée ni ne retouche sans autorisation (elles
 * viennent du design, pas des tests : hors des chemins d'écriture de la qa).
 */
const REFERENCE_CAPTURES = [/^apps\/web\/design\/handoff-v6\/design\/reference\//];

/** Configurations qui décident de ce qui est testé et du seuil : jamais modifiées sans autorisation. */
const CONFIG_PATTERNS = [
  /(^|\/)vitest(\.[\w-]+)*\.(config|workspace)\.[cm]?[jt]s$/,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /(^|\/)\.(c8rc|nycrc)(\.json|\.ya?ml)?$/,
  // Test par mutation (Stryker) : configuration sous tous les noms que Stryker lit
  // (stryker.config.mjs, stryker.conf.json, .stryker.config.mjs…), projet TypeScript de son
  // vérificateur (tsconfig.stryker.json : des options plus lâches ou plus strictes changeraient
  // les mutants classés « CompileError », donc le score) et fichier des mutants équivalents
  // déclarés (stryker.equivalents.json, phase 2) ; le motif couvre toute variante stryker.<x>.<ext>.
  /(^|\/)(\.|tsconfig\.)?stryker(\.[\w-]+)*\.(json|[cm]?[jt]s)$/,
  // Parcours navigateur du front : projets (tailles d'écran), délais, reprises, serveur testé.
  /(^|\/)playwright(\.[\w-]+)*\.config\.[cm]?[jt]s$/,
  // turbo.json racine et configurations de paquet (apps/web/turbo.json…), qui redéfiniraient
  // les tâches de test d'un paquet.
  /(^|\/)turbo\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^\.husky\//,
  /^\.github\/workflows\//,
  /^scripts\/ci\//,
];

/** Les garde-fous eux-mêmes et la définition des agents. */
const GUARD_PATTERNS = [
  /^\.claude\/settings(\.local)?\.json$/,
  /^\.claude\/hooks\//,
  /^\.claude\/agents\//,
];

/** État des garde-fous (instantanés, autorisations, journal) : seuls les scripts l'écrivent. */
const STATE_PATTERNS = [/^\.claude\/hooks\/state\//, /^\.claude\/hooks\/audit\.log$/];

/**
 * Classe un chemin relatif : 'state', 'guard', 'config', 'test' ou null (fichier ordinaire).
 * L'ordre compte : l'état et les garde-fous priment (un test des hooks est d'abord un garde-fou).
 */
export function classify(rel) {
  if (STATE_PATTERNS.some((re) => re.test(rel))) return 'state';
  if (GUARD_PATTERNS.some((re) => re.test(rel))) return 'guard';
  if (CONFIG_PATTERNS.some((re) => re.test(rel))) return 'config';
  if (TEST_PATTERNS.some((re) => re.test(rel))) return 'test';
  if (REFERENCE_CAPTURES.some((re) => re.test(rel))) return 'test';
  return null;
}

/** Un oracle est tout fichier classé (hors état, qui n'est pas versionné). */
export function isOracle(rel) {
  const c = classify(rel);
  return c !== null && c !== 'state';
}

/** Segment de chemin qui désigne une zone de tests, même si le dossier n'existe pas encore. */
export function hasTestSegment(rel) {
  return /(^|\/)(test|tests|__tests__|fixtures|__fixtures__|__snapshots__|[^/]+-snapshots)(\/|$)/.test(
    rel,
  );
}

// Marqueurs de Vitest qui sautent, isolent ou inversent un test : skip, only, todo, skipIf et
// runIf toujours interdits ; fails admis seulement sous autorisation (qa, correcteur) pour un
// test en échec attendu. Repérés quand ils suivent un point et précèdent une parenthèse
// directement ou après un enchaînement (each, concurrent…) ; « it.fails » cité en prose ne
// compte pas.
// BF-9 : l'échec attendu n'est reconnu, avant la parenthèse ou le gabarit, qu'après une ou
// plusieurs méthodes de l'API de test de Vitest 5 (clés de createChainable et méthodes qui
// déclarent un test : each, for, extend…), plus après n'importe quel appel : la portée d'échec
// attendu de GRANTABLE suivie d'includes ou de map n'est pas un marqueur. Les marqueurs interdits
// gardent l'enchaînement libre (détection plus large, sans autorisation possible).
const MARKER_RE =
  /\.(?:(skip|only|todo|skipIf|runIf)(?=\s*\(|\.\w+\s*[(`])|(fails)(?=\s*\(|(?:\.(?:each|for|concurrent|sequential|shuffle|skip|only|todo|fails|skipIf|runIf|extend|scoped|override))+\s*[(`]))/g;
// Playwright (front, lot F0) : skip et only sont déjà couverts ci-dessus ; fixme saute un test et
// slow triple son délai (toujours interdits), fail inverse le résultat (échec attendu, comme fails
// de Vitest). Repérés seulement après `test` (ou `test.describe`) pour ne pas confondre avec
// l'appel `expect` du même nom, qui fait échouer un test.
const PLAYWRIGHT_MARKER_RE =
  /(?<![\w$.])test(?:\.describe)?(?:\.(?:serial|parallel))?\.(fixme|slow|fail)(?=\s*\()/g;
// Commentaires qui retirent du code de la mesure de couverture.
const IGNORE_RE = /\b(?:v8|c8|istanbul)\s+ignore\b|node:coverage\s+(?:ignore|disable)/g;

/** Compte les marqueurs d'un texte : { forbidden, fails, kinds }. */
export function countMarkers(text) {
  const result = { forbidden: 0, fails: 0, kinds: new Set() };
  if (typeof text !== 'string' || text.length === 0) return result;
  for (const m of text.matchAll(MARKER_RE)) {
    if (m[2] === undefined) result.forbidden += 1;
    else result.fails += 1;
    result.kinds.add(`.${m[1] ?? m[2]}`);
  }
  for (const m of text.matchAll(PLAYWRIGHT_MARKER_RE)) {
    if (m[1] === 'fail') result.fails += 1;
    else result.forbidden += 1;
    result.kinds.add(`test.${m[1]}`);
  }
  for (const m of text.matchAll(IGNORE_RE)) {
    result.forbidden += 1;
    result.kinds.add(m[0].replace(/\s+/g, ' '));
  }
  return result;
}

/** Vrai si le texte contient au moins un marqueur (pour les commandes shell). */
export function hasMarker(text) {
  const c = countMarkers(text);
  return c.forbidden + c.fails > 0;
}

/**
 * Portées d'autorisation et rôles qui peuvent les recevoir. « main » est la session principale
 * (l'orchestrateur ou Julien) : elle n'a pas d'agent_type.
 * - tests  : modifier ou supprimer un test existant (test établi faux, marqueur `fails` retiré) ;
 * - fails  : écrire un test en échec attendu (marqueur `fails`) ;
 * - config : modifier une configuration de test, de CI ou les garde-fous.
 * Les autres marqueurs et les commentaires d'ignore ne sont autorisables par personne.
 */
export const GRANTABLE = {
  // dev-contrats, dev-sql, dev-api : seulement quand un brief validé par Julien rend un test existant
  // obsolète (décision du 19 nov. 2026), avec Justification-test BF-n.
  // qa-front : mêmes portées que qa, pour les tests du front (lot F0).
  tests: ['correcteur', 'qa', 'qa-front', 'main', 'dev-contrats', 'dev-sql', 'dev-api'],
  fails: ['qa', 'qa-front', 'correcteur', 'main'],
  config: ['lead-architecte', 'dev-devops', 'main'],
};

/** Portée d'autorisation requise pour modifier un fichier d'une classe donnée. */
export function scopeFor(kind) {
  if (kind === 'test') return 'tests';
  if (kind === 'config' || kind === 'guard') return 'config';
  return null;
}

const TEST_WRITES = TEST_PATTERNS;
const ENV_FILES = [/(^|\/)\.env$/];
const REVIEW_DOCS = [/^docs\/revues\//];

/**
 * Rôles dont l'écriture (outils Edit/Write et cibles explicites du shell) est limitée à certains
 * chemins du dépôt. Les autres rôles n'ont pas de limite de chemin ici (la règle « modules isolés »
 * reste vérifiée en recette). Le dossier temporaire de session est toujours libre.
 */
export const ROLE_WRITE_SCOPES = {
  qa: [...TEST_WRITES, /^docs\/comptes-rendus\//, ...ENV_FILES],
  'qa-front': [...TEST_WRITES, /^docs\/comptes-rendus\//, ...ENV_FILES],
  'revue-code': [...REVIEW_DOCS, ...ENV_FILES],
  'revue-securite': [...REVIEW_DOCS, ...ENV_FILES],
  'revue-a11y': [...REVIEW_DOCS, ...ENV_FILES],
  triage: [...REVIEW_DOCS, ...ENV_FILES],
  'chef-de-projet': [
    /^docs\/backlog\.md$/,
    /^docs\/comptes-rendus\//,
    /^docs\/compte-rendu-[^/]+\.md$/,
    ...ENV_FILES,
  ],
};

/** Vrai si le rôle peut écrire ce chemin relatif (rôle sans limite : toujours vrai). */
export function roleMayWrite(role, rel) {
  const scope = ROLE_WRITE_SCOPES[role];
  return scope === undefined || scope.some((re) => re.test(rel));
}

/** Rappel injecté au démarrage d'un sous-agent. */
export function startReminder(role) {
  const limits = ROLE_WRITE_SCOPES[role]
    ? ' Ton rôle limite aussi les chemins que tu peux écrire.'
    : '';
  return (
    `Garde-fous actifs (agent ${role}). Refusés : modifier ou supprimer un test existant, ses fixtures ` +
    'ou test/support, une configuration de test, de couverture ou de mutation (Stryker), turbo.json, pnpm-workspace.yaml, ' +
    '.husky, .github/workflows, scripts/ci, .claude ; écrire un marqueur de saut ou de focus de ' +
    "Vitest ou un commentaire d'ignore de couverture. Créer un nouveau fichier de test est permis." +
    limits +
    ' Aucun git push : seule la session principale pousse, et uniquement develop vers origin.' +
    ' Un refus ne se contourne pas : si un test paraît impossible, contradictoire ou faux, applique ' +
    'la sortie honorable (CLAUDE.md, « Agents et garde-fous »). Les oracles sont comparés à un ' +
    'instantané à la fin de ta tâche.'
  );
}
