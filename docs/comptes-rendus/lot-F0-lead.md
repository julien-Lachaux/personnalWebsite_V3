# Lot F0 : fondations du front (lead-architecte)

Date : 19 novembre 2026. Branche `lot/F0-fondations` (worktree `.claude/worktrees/lot-F0-fondations`),
créée depuis `develop` (a0753e7), avancée en avance rapide sur `develop` (09b7f0c, lot 13 bis et
portée tests BF) avant de toucher aux garde-fous, pour ne pas croiser la session back.
Isolation : `.env` racine `COMPOSE_PROJECT_NAME=siteperso-v3-f0`, `POSTGRES_PORT=5842`,
`POSTGRES_TEST_PORT=5843`, plus `PLAYWRIGHT_PORT=5844` et `WEB_E2E_PORT=5845` (choisis dans la plage
58xx du front) ; `apps/api/.env` sur 5842. Autorisation de configuration : 7302c938.
Rien n'a été modifié dans `apps/api/`, `db/` ni `packages/contracts/`.

## Fait

| Ticket | Livré | Preuve |
|---|---|---|
| F0-01 | `apps/web` (`@siteperso/web`) Nuxt 4.6.4, TypeScript strict (options de `tsconfig.base.json` reportées dans les quatre tsconfig générés), ESM, dépendance `@siteperso/contracts` (workspace) ; `app/app.vue`, page provisoire `app/pages/index.vue` (un `h1`, lien vers l'autre langue) ; aucun fichier vide (les dossiers `domain/`, `data/`, `components/`… naîtront avec leur premier fichier, structure écrite dans CLAUDE.md) | `pnpm --filter @siteperso/web dev` puis `curl -s http://localhost:3001/` : `<html lang="fr">`, `<h1>Site en construction`, hreflang x-default, fr, en ; `curl -s http://localhost:3001/en` : `<html lang="en">`, `<h1>Website under construction` ; route inconnue 404. `pnpm --filter @siteperso/web generate` : « Prerendered 8 routes », `.output/public/index.html` (`lang="fr"`) et `.output/public/en/index.html` (`lang="en"`) |
| F0-02 | ESLint : `apps/web/eslint.config.js` = configuration racine + `eslint-plugin-vue` (flat/recommended) + `eslint-plugin-vuejs-accessibility`, typé aussi dans les `.vue` (service de projet + `extraFileExtensions`), `vue/no-v-html` en erreur, `--max-warnings 0` ; Prettier (`.prettierignore` : `.nuxt`, `.output`, rapports Playwright, handoff) ; scripts `lint`, `typecheck` (`vue-tsc -b`), `test`, `test:coverage`, `test:e2e`, `test:mutation`, `build` = `generate` ; branchés dans Turborepo (tâches `@siteperso/web#build` et `#test:e2e`), `pnpm check` (`pnpm e2e:browsers:up` ajouté) ; le hook pre-commit (`turbo run lint typecheck test`) couvre le front sans changement | `pnpm check` vert deux fois (voir plus bas) ; sonde : un `.vue` avec `v-html`, `@click` sur un `div` et `<img>` sans `alt` donne `vue/no-v-html`, `vuejs-accessibility/click-events-have-key-events`, `no-static-element-interactions`, `alt-text` en erreur (fichier retiré) ; sonde de typage : `'a'` affecté à un `number` et `o.a.length` sur un optionnel refusés par `vue-tsc -b` (TS2322, TS18048) |
| F0-03 | Vitest : projets `unit` (`app/domain`, `app/data`, `app/architecture.spec.ts`, Node) et `nuxt` (`@nuxt/test-utils` 4.4.0, `mountSuspended`, happy-dom) ; couverture v8 fusionnée, seuil 100 % sur `app/**/*.{ts,vue}`, aucune exclusion hors `*.spec.ts` ; tests d'`app.vue` (lang, hreflang, canonical en fr et en) et de la page (h1 unique, lien de langue dans les deux sens) ; test d'architecture (`app/domain` sans `vue`, `nuxt`, `#imports`, `#app`, composants, composables ni données ; `app/data` sans composants ni pages), qui prouve aussi son détecteur sur des sources et un arbre temporaire. Stryker 10.1.1 sur `app/domain` et `app/data`, seuil de rupture 100, job CI `mutation` étendu au front | `pnpm --filter @siteperso/web test:coverage` : 10 tests, 100 % (12/12 instructions, 2/2 branches, 4/4 fonctions, 9/9 lignes) ; `pnpm --filter @siteperso/web test:mutation` : sortie 0, « Final mutation score of NaN is greater than or equal to break threshold 100 » (aucun fichier à muter) ; sonde (fonction `clamp` dans `app/domain`, retirée ensuite) : test faible 11,11 % et code 1, tests forts 77,78 % (deux mutants de borne équivalents) et code 1 : le seuil mord |
| F0-04 | Playwright 1.65.1 + `@axe-core/playwright` 4.14.0 ; sept projets (mobile-390 390×844, tablette-834 834×1112, portable-1024 1024×768, desktop-1280 1280×844, grand-1440 1440×900, fullhd-1920 1920×1080, ultra-3440 3440×1440) ; fumée en fr et en, schémas `light` et `dark` (`test.use({ colorScheme })`, vérifié par `matchMedia`) : statut 200, `lang`, h1 unique, hreflang fr/en/x-default, aucune violation axe sur `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, navigation vers l'autre langue ; témoin : axe signale `color-contrast`, `html-has-lang`, `image-alt` sur une page non conforme. `test:e2e` = `nuxt generate && playwright test`, appelé par `pnpm check` et le job CI `front` | `pnpm --filter @siteperso/web exec playwright test` : 35 tests verts (28 fumées + 7 témoins) |
| F0-05 | `@nuxtjs/i18n` 10.6.0, `prefix_except_default`, FR par défaut sans préfixe, EN sous `/en`, `detectBrowserLanguage: false`, `i18n/locales/fr.json` et `en.json`, `useLocaleHead` dans `app.vue` : `lang`, `hreflang` (fr, en, x-default), `canonical`, `og:locale` ; URL absolue par `baseUrl` (surchargée par `NUXT_PUBLIC_I18N_BASE_URL`) | `app/app.spec.ts` ; HTML généré : `<link rel="alternate" hreflang="en" href="http://localhost:3001/en">`, `canonical` |
| F0-06 | `policy.mjs` : configuration Playwright (tous ses noms), `turbo.json` de paquet, parcours `*.e2e.ts`, captures attendues `<test>-snapshots/`, captures de référence du handoff (classe « test », hors chemins d'écriture de la qa) ; marqueurs de Playwright (`fixme`, `slow` interdits, `fail` = échec attendu, repérés après `test`/`test.describe` pour laisser l'appel du même nom sur `expect`) ; rôles `qa-front` (tests et comptes rendus, portées tests et fails) et `revue-a11y` (docs/revues). `check-tests-integrity.sh` : mêmes motifs. CI : job `front` (navigateurs par le même service docker compose, `turbo run lint typecheck test:coverage test:e2e --filter=@siteperso/web`, résumé de couverture, artefacts), job `mutation` avec le rapport du front | `pnpm hooks:test` : 535/535 ; `pnpm integrity:test` : 19 + 3 + 8 réussis ; `pnpm integrity develop` : OK. Démonstration sur un clone jetable (dossier temporaire) : commit qui modifie `apps/web/test/smoke.e2e.ts` sans justification → `ÉCHEC test existant modifié sans Justification-test : apps/web/test/smoke.e2e.ts`, code 1 ; commit qui modifie `playwright.config.ts`, une capture de référence et crée `apps/web/turbo.json` → trois `ÉCHEC`, puis `OK` après ajout d'une ligne Justification-test ; nouveau parcours avec `test.fixme` → `ÉCHEC marqueur … ajouté` et `marqueur interdit dans l'arbre` ; test de composant `apps/web/app/pages/index.spec.ts` modifié → `ÉCHEC`, nouvelle capture attendue acceptée puis la même régénérée → `ÉCHEC test existant modifié … smoke.e2e.ts-snapshots/a.png`. Classification : `node` sur `policy.mjs` du worktree (configurations du front = `config`, tests, fixtures, captures = `test`, code et SPEC = ordinaires ; `roleMayWrite('qa-front', 'apps/web/app/domain/filter.ts')` = false, capture de référence = false ; `revue-a11y` hors `docs/revues` = false). Les tests automatisés des hooks et du script : voir « Points ouverts » |
| F0-07 | `.claude/agents/dev-front.md` (Sonnet, high ; règle « modules isolés » du front), `qa-front.md` (Sonnet, medium ; tests seulement), `revue-a11y.md` (Opus, high ; lecture seule, `docs/revues/a11y-<date>.md`, chaque finding constaté par une commande), au format des agents existants ; sections front de `lead-architecte`, `dev-devops`, `revue-code`, `revue-securite` (contenus de docs/05) ; tableau des agents de `docs/03` | fichiers commités (0ef78ae, a44991e) |
| F0-08 | `CLAUDE.md` : section « Front » (structure d'`apps/web`, couches, règle « modules isolés » du front, i18n, accessibilité, `NUXT_PUBLIC_CONTACT_EMAIL` avec placeholder `contact@example.org` dans `apps/web/.env.example`, tests, `nuxt prepare`), commandes `pnpm --filter @siteperso/web …`, `pnpm dev:web`, `pnpm e2e:browsers:up`, ports des worktrees, quatorze agents, marqueurs de Playwright ; README ; handoff versionné à l'identique dans `apps/web/design/handoff-v6/` (D7, 64 fichiers, 9,8 Mo, `diff -r` identique, aucun e-mail ni téléphone par recherche de motifs ; le lien LinkedIn public y figure, déjà présent dans `db/seeds/0002_social_links.sql`) ; `docs/02` section Front alignée sur D1 à D8 | commits 9e580bd, 9c70c61, 7559fbc |

`pnpm check` : deux passes vertes sur conteneurs neufs (détail dans « Vérifications finales »).

## Décisions (versions vérifiées le 19 nov. 2026 par `pnpm view`, épinglées exactement)

- **Versions** : nuxt 4.6.4, @nuxtjs/i18n 10.6.0, vue 3.5.45, vue-router 5.5.1, @nuxt/test-utils
  4.4.0, @vue/test-utils 2.6.0, happy-dom 21.0.4, vitest et @vitest/coverage-v8 5.1.1 (comme le
  back), @playwright/test 1.65.1, @axe-core/playwright 4.14.0, eslint-plugin-vue 10.12.1,
  vue-eslint-parser 10.4.2, eslint-plugin-vuejs-accessibility 2.6.3 (+ globals 17.14.0, son pair),
  vue-tsc 3.3.14, @stryker-mutator/core et vitest-runner 10.1.1, sirv-cli 3.0.1, @types/node 26.6.6.
  Image `mcr.microsoft.com/playwright:v1.65.1-noble` épinglée par digest
  `sha256:1507cbfc…f525579` (Node 26.13.1 dans l'image).
- **TypeScript 6.0.3, pas 7.0.2** : 7.0.2 est la dernière publiée (juillet 2026), mais
  `typescript-eslint` 8.73.0 (dernière) exige `typescript >=4.8.4 <6.1.0` ; le monorepo entier est
  en 6.0.3. Même version pour le front, sans rétrograder quoi que ce soit (à rediscuter avec Julien
  quand typescript-eslint suivra).
- **Navigateurs Playwright en Docker, lanceur sur l'hôte** (au lieu de lancer tout Playwright dans
  l'image, ou de télécharger les navigateurs sur l'hôte) : service `playwright` de
  `docker-compose.yml` (`playwright run-server`, procédure « Remote connection » de la doc
  Playwright), `connectOptions.wsEndpoint` + `exposeNetwork: '<loopback>'` (option documentée de
  `connectOptions`) pour que le navigateur joigne le site servi sur l'hôte. Motifs : rien
  d'installé sur l'hôte, Node 26 de pnpm et dépendances du lockfile côté lanceur, même commande
  en local et en CI (`pnpm e2e:browsers:up`), ports isolables par worktree. Alternative écartée :
  job CI `container: mcr.microsoft.com/playwright` (Node et pnpm à réinstaller dans l'image,
  divergence avec le local).
- **Site testé = sortie de `nuxt generate` servie par sirv** (`reuseExistingServer: false` : un
  port déjà pris échoue au lieu de tester un autre serveur). Alternative écartée : `nuxt dev`
  (pas ce qui part en production).
- **Projets Vitest par dossier** (`unit` : domain, data, architecture ; `nuxt` : le reste d'`app/`)
  plutôt que par suffixe ou par commentaire `@vitest-environment` (que la doc de Nuxt déconseille).
  Le projet `nuxt` est écarté sous Stryker (`STRYKER_MUTATOR_WORKER`), même mécanisme que le
  projet e2e de l'API.
- **Stryker du front sans vérificateur TypeScript** : le vérificateur compile avec `tsc`, qui ne
  lit pas les `.vue` ; avec `tsconfig.json` (projets de Nuxt), la passe initiale échoue
  (`TS2307 Cannot find module './app.vue'`). Sans lui, un mutant qui ne compile pas est jugé par
  les tests : la mesure est au moins aussi stricte. `@stryker-mutator/typescript-checker` n'est donc
  pas installé dans le front. `related: false` (sinon « No tests were executed » tant qu'aucun
  fichier n'est muté) ; `.nuxt` réintégré dans la sandbox (`!.nuxt` : Stryker 10 l'écarte toujours,
  constaté dans `project-reader.js`, `ALWAYS_IGNORE`).
- **Seuil de mutation du front à 100 dès le départ** : règle « aucun survivant non justifié »,
  rien à mesurer avant F2 ; jamais abaissé.
- **`build` du front = `nuxt generate`** (D2) : `pnpm build` produit le site statique ; cache Turbo
  sur `.output/**`, empreinte incluant `NUXT_PUBLIC_*` et `apps/web/.env` (sinon un site généré avec
  d'autres valeurs serait resservi, et le mode strict de Turbo ne transmettrait pas ces variables).
- **`.nuxt` préparé par `postinstall: nuxt prepare`** (gabarit officiel de Nuxt) et non par chaque
  script : `lint`, `typecheck` et `test` tournent en parallèle sous Turbo et liraient un `.nuxt` en
  cours de réécriture. `nuxt generate` construit dans `node_modules/.cache/nuxt/.nuxt` (constaté),
  sans collision avec `.nuxt`.
- **ESLint typé aussi dans les `.vue`** (service de projet + `extraFileExtensions: ['.vue']`,
  constaté fonctionnel) ; `no-undef` coupé dans les `.vue` (auto-imports, vérifiés par vue-tsc) ;
  `vue/multi-word-component-names` coupé pour les pages, gabarits, `app.vue` et `error.vue` (noms
  imposés par le routage).
- **Garde-fous** : les captures de référence du handoff sont des oracles de classe « test » (on ne
  les retouche ni ne les remplace sans autorisation), hors des chemins d'écriture de la qa ; les
  marqueurs `fixme`/`slow`/`fail` de Playwright, absents des motifs existants (`.skip`, `.only`
  étaient déjà couverts), sont ajoutés (sinon `test.fixme` sautait un test sans rien déclencher).
- **Handoff versionné en entier**, `.dc.html` compris (580 Ko, référencés par `SPEC.md` et
  `README.md` du handoff pour vérifier un style précis).

## Non fait (hors périmètre F0 ou bloqué)

- Design system, polices, composants, logique métier, couche de données : lots F1 à F4.
- Tests automatisés des garde-fous du front dans `.claude/hooks/tests/` et `scripts/ci/tests/` :
  écrits mais non commités (point ouvert 1).
- `.claude/hooks/README.md` non mis à jour (liste des oracles et des marqueurs) : chemin hors
  autorisation (point ouvert 1).

## Points ouverts

1. **Autorisation manquante pour les tests des garde-fous (sortie honorable).** F0-06 demande des
   tests des hooks et des cas d'intégrité ; l'autorisation 7302c938 couvre `policy.mjs` et
   `check-tests-integrity.sh` mais ni `.claude/hooks/tests/**`, ni `scripts/ci/tests/**`, ni
   `.claude/hooks/README.md` (classés « guard » ou « config » : création refusée sans autorisation).
   De plus, les hooks refusent à un sous-agent d'exécuter un script situé sous `.claude/hooks/`, même
   copié dans le dossier temporaire (« les scripts des garde-fous ne se lancent que depuis la
   session principale ») et un `bash` sur un script qui nomme un oracle (« écriture opaque »).
   Je ne les ai donc ni créés ni contournés. Les deux fichiers prêts à copier sont dans
   `docs/comptes-rendus/lot-F0-lead-annexe-tests.md` (`front-oracles.test.mjs` : classification,
   rôles, marqueurs de Playwright, refus des hooks sur les oracles du front, intégrité ;
   `front-integrity.test.sh` : huit cas). Ce qui les remplace pour l'instant : les démonstrations
   de la ligne F0-06 (clone jetable, `pnpm integrity`). Demande : une autorisation `config` sur
   `.claude/hooks/tests/front-oracles.test.mjs`, `scripts/ci/tests/front-integrity.test.sh` et
   `.claude/hooks/README.md`, ou leur application par la session principale.
2. **Tolérance de la régression visuelle** : `docs/05` (F8-03) dit « tolérance fixée en F0 », mais
   les tickets F0 n'en parlent pas et aucune valeur n'est décidée. Proposition, à trancher par
   Julien : `expect.toHaveScreenshot.pathTemplate` vers
   `design/handoff-v6/design/reference/{arg}{ext}` (comparaison directe aux captures du handoff,
   protégées) et une tolérance `maxDiffPixelRatio` mesurée sur le premier écran réel (F3), les
   maquettes venant d'un autre moteur de rendu (canvas).
3. **Libellés des sections en parallèle (F5-A ∥ F5-B)** : `fr.json` et `en.json` sont des fichiers
   uniques ; deux agents y ajoutent leurs clés `<section>.` et risquent un conflit de fusion.
   Proposition pour le lead avant F5 : un fichier de messages par section (`@nuxtjs/i18n` accepte
   plusieurs fichiers par langue), changement de `nuxt.config.ts`.
4. **CSP et carte d'import de Nuxt (pour F9)** : le HTML généré contient un
   `<script type="importmap">` en ligne ; la CSP stricte devra en porter l'empreinte, comme le
   script de thème (D5). Noté dans la section front de `dev-devops.md`.
5. **Avertissements de pairs de Nuxt** : `pnpm install` signale `@babel/plugin-*` 8 qui attendent
   `@babel/core` 8 alors que `@vitejs/plugin-vue-jsx` (dépendance de Nuxt 4.6.4) installe 7.29.13 ;
   interne à Nuxt, sans effet constaté (generate, dev, tests verts). À revoir à la prochaine
   version de Nuxt.
6. **Audit** : `pnpm audit --prod --audit-level=high` reste vert (1 avis modéré) ; `pnpm audit`
   complet : 6 avis modérés en dépendances de développement (`qs` et `minimatch` via
   `@stryker-mutator/core`, déjà présents côté back ; `glob` via `@vue/test-utils` → `js-beautify`).
7. **Noms de fichiers non ASCII dans `check-tests-integrity.sh`** (constaté pendant la
   démonstration, antérieur à F0) : `git diff` cite le chemin (`"b/apps/web/test/cass\303\251.e2e.ts"`),
   si bien que la recherche d'une Justification-test sur ce fichier ne le retrouverait pas
   (`git log -- <chemin cité>`) : un marqueur `fails` justifié dans un fichier au nom accentué
   serait refusé à tort. Correction possible : `git -c core.quotePath=false`. À trier.
8. **Image Playwright et `npx`** : le service lance `npx -y playwright@1.65.1 run-server`
   (procédure documentée) : le paquet est téléchargé du registre npm au démarrage du conteneur,
   version exacte mais hors lockfile. Alternative pour la revue de sécurité : petite image dérivée
   qui installe la même version au build.

9. **Faux positif du motif d'échec attendu** (antérieur à F0) : `FAILS_RE` du script d'intégrité et
   `MARKER_RE` des hooks prennent l'appel `includes` sur la portée d'échec attendu de `GRANTABLE`
   pour un marqueur (forme « point, nom de la portée, point, méthode, parenthèse », prévue pour
   l'enchaînement `each` de Vitest). Constaté sur une première version de l'annexe (`ÉCHEC test en
   échec attendu ajouté sans Justification-test`), évité dans la proposition par une
   déstructuration, sans toucher au motif. À trier si d'autres fichiers en ont besoin.

## Demandes pour la session back

Aucune modification demandée dans `apps/api/`, `db/` ou `packages/contracts/`. Fichiers racine
touchés en commits dédiés, à prendre en compte en fusionnant (`docker-compose.yml`, `.env.example`,
`package.json`, `turbo.json`, `pnpm-lock.yaml`, `.prettierignore`, `.github/workflows/ci.yml`,
`scripts/ci/check-tests-integrity.sh`, `.claude/hooks/lib/policy.mjs`, `CLAUDE.md`, `README.md`,
`docs/02`, `docs/03`). Points d'attention :

- `pnpm check` démarre désormais aussi le service `playwright` (`pnpm e2e:browsers:up`) : un
  worktree back qui lance `pnpm check` doit avoir `PLAYWRIGHT_PORT` et `WEB_E2E_PORT` propres dans
  son `.env` racine (défauts 3100 et 4173), sinon deux worktrees se disputent ces ports.
- L'image API (`docker/api.Dockerfile`, `pnpm install --frozen-lockfile` avec les seuls
  `package.json` de l'API et des contrats) se construit toujours avec le nouveau lockfile :
  `docker build -f docker/api.Dockerfile .` réussi (image d'essai supprimée).
- L14-03 (mutation incrémentale sur `develop`) touchera le même job `mutation` : le front y est
  entré par `pnpm test:mutation` (Turbo) et son rapport dans l'artefact.
- `policy.mjs` : `GRANTABLE.tests` et `fails` reçoivent `qa-front`, à côté de l'ouverture BF de la
  session back (fusion sans conflit à cette base).

## Vérifications finales

- `pnpm format` : aucun fichier modifié.
- `pnpm check`, deux passes, `docker compose down -v` avant chacune (postgres-test et navigateurs
  neufs), code 0 les deux fois : hooks 535/535, intégrité 19 + 3 + 8 cas, `Intégrité des tests :
  OK` ; lint, typecheck, unitaires (API 391, contrats 133, front 10), e2e (API 552, front 35
  Playwright) : 12 tâches réussies ; couverture 100 % sur les quatre métriques pour l'API
  (711/711 instructions, 236/236 branches), les contrats (51/51, 2/2) et le front (12/12, 2/2,
  4/4 fonctions, 9/9 lignes).
- `pnpm build` : contrats, API et `nuxt generate` du front réussis.
- `pnpm --filter @siteperso/web test:mutation` : code 0 (aucun fichier à muter, seuil 100).
- `pnpm integrity develop` : OK. `pnpm db:down` en fin de lot ; arbre de travail propre (`.env`
  racine, `apps/api/.env`, `.nuxt`, `.output`, rapports : gitignorés).
