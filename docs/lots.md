# Les lots du chantier back-end V3

Synthèse, lot par lot, de ce qui a été fait depuis le 18 novembre 2026. Chaque lot a sa branche
`lot/N-nom`, un worktree isolé, un agent (ou deux) qui livre, une recette du chef de projet, puis une
fusion `--no-ff` dans la branche d'intégration par l'orchestrateur : `v3/backend` jusqu'au lot 12,
`develop` depuis le lot 13 (git flow). Le détail de chaque lot est dans
`docs/comptes-rendus/lot-N-*.md` ; les tickets et critères dans `docs/backlog.md` ; les décisions de
référence dans `docs/01` à `docs/03`. Premier push sur GitHub (dépôt privé) le 19 novembre 2026 au soir,
après la revue de sécurité de pré-publication (`docs/revues/securite-pre-publication-2026-11-19.md`) :
`main` (avance rapide depuis l'intégration) et l'ancienne `v3/backend`, renommée `develop` au lot 13.

| Lot | Nom | Agent(s), modèle | Fusionné | Tests après fusion |
| --- | --- | --- | --- | --- |
| 0 | Fondations | lead back-end, Opus | 3f94f04 | e2e health, sécurité, CORS, quotas |
| 0 bis | Node 26, OpenAPI 3.2.0 | lead, Opus | a8a0c87 | idem |
| 1 | SQL : runner, migrations, seeds | dev base de données, Sonnet | 8339103 | e2e seeds et contraintes |
| 2 | Contrats Zod et OpenAPI | dev contrats, Sonnet | 2d7d7eb | 75 tests contrats |
| 3 A / 3 B | API : 12 ressources en parallèle | deux dev API, Sonnet | 708f337, b6d48e0 | unitaires + e2e par ressource |
| 3 bis | Intégration de `cv`, alignements | agent d'intégration, Sonnet | 45621c2 | 13 routes vertes |
| 4 | QA | qa, Sonnet | 41ce451 | 207 unitaires, 412 e2e |
| 5 | DevOps | devops, Sonnet | d37c8da | CI, image, compose prod |
| 5 bis | Vérification de bout en bout | devops, Sonnet | 0ae41a6 | pile prod locale testée |
| 6 | Revues indépendantes, triage, corrections | 2 revues Opus, triage + correcteur Sonnet | ecedc7c | 275 unitaires, 473 e2e |
| 7 | Couverture 100 % fusionnée | dev, Sonnet | 67f7b76 | 776 tests API, 100 % |
| 8 | Agents spécialisés et garde-fous | lead-architecte, Opus | b16f9e7 | 30 tests hooks, 19 cas d'intégrité |
| 9 | Décisions du 19 novembre | correcteur (agent du dépôt), Sonnet | c4af5fd | 859 tests API, 100 % |
| 10 | Pile locale complète avec Caddy | dev-devops (agent du dépôt), Sonnet | ecb6d7f | 561 e2e avec la pile, 100 % |
| 11 | Test par mutation, phase 1 | lead-architecte (agent du dépôt), Opus | dc0d9d4 | score de référence 32 % (contrats et API) |
| 12 | Test par mutation, phase 2 : la règle | qa Sonnet, lead-architecte Opus, chef-de-projet Sonnet | 5ee5690 | 133 + 389 unitaires, 552 e2e, mutation 100 % / 40,87 % |
| 13 | Git flow : `develop`, push de la session principale | lead-architecte Opus, chef-de-projet Sonnet | 802360b | 115 tests hooks, 133 + 391 unitaires, 552 e2e, 100 % |
| 13 bis | Durcissement des refus de push et de l'analyseur | lead-architecte Opus, chef-de-projet Sonnet | fb31042 | 527 tests hooks, 133 + 391 unitaires, 552 e2e, 100 % |
| 14 | Garde-fous, CI, e2e de l'API en parallèle, `pnpm check` en une passe (L14-01 à 03, 06 à 17) | dev-api Sonnet, lead-architecte Opus (×3), dev-devops Sonnet, chef-de-projet Sonnet | e7607a4 | 768 tests hooks, 13 husky, 220 + 430 unitaires, 764 e2e de l'API (20 s au lieu de 254 s), 100 %, mutation API seuil 41 |
| 15 | Brief back-001 du front (BF-1 à BF-7) | dev-sql Sonnet, dev-api Sonnet, chef-de-projet Sonnet | baa259d | 220 + 430 unitaires, 705 e2e, 100 %, mutation 100 % / 42,03 % |
| 16 | Briefs back-002 et back-003 : intégrité des tests, instantanés des hooks (BF-8 à BF-11) | lead-architecte Opus, chef-de-projet Sonnet | c382bae | 569 tests hooks (20 ajoutés), scripts d'intégrité verts, 100 % |
| 17 | Brief back-004 : lieu nul de l'expérience OpenClassrooms (BF-12) | dev-sql Sonnet, chef-de-projet Sonnet | d5f2097 | 1 e2e ajouté (5 cas), 100 % |

## Lot 0 : fondations

- **Objectif** : squelette du monorepo et conventions pour tous les lots suivants.
- **Livré** : monorepo pnpm + Turborepo, TypeScript strict, ESLint, Prettier, husky ; `apps/api` NestJS
  sur Fastify en architecture hexagonale (`domain` / `application` / `infrastructure`) ; erreurs
  RFC 9457 problem+json par un filtre global ; `GET /health` avec ping SQL et `GET /docs.json` ; un
  module vide par ressource de `docs/01` (GET en 501) ; helmet, CORS restreint, rate limiting 100
  requêtes par minute et par IP ; `docker-compose.yml` avec Postgres de dev et de test ; `CLAUDE.md`.
- **Recette** : acceptée au second passage (3 commits de correction). Le workflow initial avait été
  coupé par la limite horaire du modèle, repris dans le même worktree.

## Lot 0 bis : Node 26 et OpenAPI 3.2.0

- **Objectif** : appliquer la décision « toujours les versions les plus récentes » et le contrat OpenAPI
  dans sa plus haute version prise en charge côté Rust.
- **Livré** : Node 26.13.1 téléchargé par pnpm (`.npmrc`, `engines`), générateur OpenAPI 3.2.0
  (`@asteasolutions/zod-to-openapi`), `info.version` 1.0.0.

## Lot 1 : SQL, runner, migrations, seeds

- **Livré** : runner de migrations maison (`schema_migrations`, checksum SHA-256, verrou consultatif,
  une transaction par fichier), runner de seeds idempotents, `db:migrate`, `db:seed`, `db:reset`
  (refusé en production) ; 7 migrations pour 24 tables (13 de contenu, 11 de traductions) ; 5 seeds
  avec le contenu du CV (profil, LinkedIn, 7 groupes et 34 compétences, 8 expériences, 3 certifications,
  3 formations, 2 langues) ; schéma Drizzle dérivé du SQL ; `docs/traductions-a-relire.md`, 68
  traductions anglaises à relire par Julien.
- **Règle** : le SQL est la source de vérité, jamais de `drizzle-kit generate` ; aucun e-mail ni
  téléphone en base.

## Lot 2 : contrats Zod et OpenAPI

- **Livré** : schémas Zod de toutes les ressources et de l'agrégat `Cv`, enums, schémas communs
  (`Slug`, `IsoDate`, `Image`, `ProblemDetails`), document OpenAPI 3.2.0 complet (13 chemins,
  paramètre `lang`, réponses d'erreur), export `dist/openapi.json`.
- **Décision prise à l'intégration** : les contrats s'alignent sur la nullabilité du SQL (`url`,
  `repoUrl`, `iconPath`, `year`, `description`), l'`alt` des images reste exigé pour l'accessibilité.

## Lot 3 A et 3 B : les 12 ressources en parallèle

- **Objectif** : deux agents en même temps, chacun sur six ressources, grâce à la règle « modules
  isolés » de `CLAUDE.md` (aucun fichier partagé touché par un agent de ressource).
- **Livré** : pour chaque ressource, domaine, cas d'usage sans décorateur, port + jeton, dépôt Drizzle,
  contrôleur Nest, tests unitaires et e2e. A : profile, social-links, skills, skill-groups, experiences,
  languages. B : projects, tools, resources, certifications, education, et le cas d'usage `cv`.
- **Leçon** : le module `cv` dépendait des classes de A, câblé au lot 3 bis après fusion des deux
  branches.

## Lot 3 bis : intégration

- **Livré** : câblage de `GET /cv` sur les onze cas d'usage, suppression des 501, alignements de
  contrats, `Project.year` et `Education.description` nullables. Les 13 routes répondent.

## Lot 4 : QA

- **Livré** : harnais de test qui se teste lui-même ; matrice 12 routes x 7 variantes de langue ;
  tests de publication et d'ordre ; erreurs (404, méthodes, HEAD, OPTIONS, 500 simulés, 503, réponse
  hors contrat) ; sécurité HTTP (en-têtes, CORS, quotas) ; conformité de chaque réponse au document
  OpenAPI par Ajv ; base migrée mais vide (aucun 5xx) ; couverture v8 avec seuils 85 % lignes et 75 %
  branches sur un périmètre réduit ; trois bugs consignés par des tests en échec attendu (URL mal
  encodée hors problem+json, OPTIONS nu en 400, 404 hors quota).

## Lot 5 : DevOps

- **Livré** : image Docker multi-étages non root (214 Mo), `docker/compose.prod.yml` (Caddy, migrate,
  api, postgres sans port exposé), `Caddyfile` avec HTTPS automatique, `.env.prod.example`, scripts
  `first-install`, `update`, `backup`, `docs/deploiement.md`, CI GitHub Actions (qualité, e2e, docker).

## Lot 5 bis : vérification de bout en bout

- **Livré** : la pile de production montée et testée en local ; deux vrais défauts corrigés (le service
  de migration ne trouvait pas le dossier SQL dans l'image, les ports 80 et 443 étaient codés en dur) ;
  isolation des conteneurs par worktree (`COMPOSE_PROJECT_NAME`, ports surchargeables) pour les agents
  en parallèle.
- **Bilan de phase** : 75 tests contrats, 207 unitaires, 412 e2e. Recette finale du chef de projet
  depuis un clone propre, compte rendu `docs/compte-rendu-2026-11-18.md`, point de contrôle 2.

## Lot 6 : revues indépendantes, triage, corrections

- **Méthode** : deux relecteurs Opus en lecture seule, code et sécurité, sans voir le rapport de
  l'autre, chaque finding reproduit ; triage par rejeu ; correcteur avec un commit par finding ;
  recette.
- **Trouvé** : 23 findings, tous confirmés, aucun faux positif ; 1 bloquant (les e2e dépendaient de
  l'ordre des fichiers : premier `pnpm check` rouge sur base neuve), 7 majeurs (dont API connectée
  en superutilisateur, pnpm 9 visé par des avis de sécurité, déni de service par corps hors quota sur
  les 404, compétences d'un groupe dépublié servies par `/projects`).
- **Corrigé** : 24 des 26 entrées, dont les trois bugs de la QA devenus de vrais tests verts ; rôle
  PostgreSQL en lecture seule ; pnpm 10.34.9 ; réseaux internes et conteneurs durcis ; actions et images
  épinglées ; délais partout ; URL limitées à `http` et `https` ; seeds convergents ; `TRUST_PROXY`
  strict ; `Server` et `Via` retirés. Rapports dans `docs/revues/`.
- **Laissé à Julien** : repli de langue (tranché au lot 9), adresse des commits (acceptée), entités
  retirées des seeds (tranché au lot 9).

## Lot 7 : couverture 100 % fusionnée

- **Décision** : « il n'y a pas de code non testé dans l'application, c'est interdit ».
- **Livré** : deux projets Vitest, unitaires et e2e, dans une seule configuration, couverture v8
  fusionnée, seuils 100 % sur lignes, branches, fonctions et instructions pour les deux paquets ;
  `pnpm test:coverage` dans `pnpm check` et en CI avec résumé et artefact ; aucune exclusion de
  production ni commentaire d'ignore ; deux replis jamais atteignables supprimés et portés par le
  typage ; points d'entrée CLI et `main.ts` testés par import après mocks.
- **Résultat** : 776 tests API et 104 tests contrats, 100 % partout. La recette a prouvé que retirer
  un test fait échouer la mesure.

## Lot 8 : agents spécialisés et garde-fous

- **Décisions** : onze agents dans `.claude/agents/` (lead-architecte, chef-de-projet, dev-sql,
  dev-contrats, dev-api, dev-devops, qa, revue-code, revue-securite, triage, correcteur), publiables
  sur GitHub sans chemin de machine, port, secret ni charge utile d'attaque ; quatre couches contre le
  contournement des tests par les agents, fondées sur une recherche des pratiques du moment.
- **Livré** : les onze fichiers ; hooks de `.claude/settings.json` qui refusent toute modification
  d'un oracle (tests existants, configurations de test et de CI, marqueurs de saut, commentaires
  d'ignore), y compris par le shell, et comparent les empreintes en fin de tâche ; exception
  nominative journalisée (`authorize.mjs`, `audit.log`) ; script `scripts/ci/check-tests-integrity.sh`
  qui exige une ligne `Justification-test` sur tout commit touchant un test existant ; sortie honorable
  pour tout agent devant un test impossible ou faux ; 30 tests de hooks, 19 cas d'intégrité.
- **Limites de la plateforme documentées** : hooks de frontmatter ignorés dans les workflows (tout
  passe par les réglages du projet et le rôle lu dans le type d'agent) ; les hooks ne sont pas un bac à
  sable, le filet est la comparaison d'empreintes et la CI.
- **Acceptés par Julien** : portée `config` pour lead-architecte et dev-devops ; marqueur `fails` pour
  la qa sous autorisation.

## Lot 9 : décisions du 19 novembre

- **Première mission des agents du dépôt sous les hooks.** Correcteur sous autorisation nominative
  sur les seuls tests que le document `docs/revues/decisions-2026-11-19.md` établit faux par décision.
- **Livré** : repli de langue par ligne et complétude de la traduction anglaise exigée au seed (DEC-1) ;
  405 problem+json avec `Allow` produit par l'API (DEC-2) ; `X-Frame-Options: DENY` et politique de
  sécurité de contenu posées par l'API, Caddy ne faisant que doubler (DEC-3) ; soft delete `deleted_at`
  sur les onze tables, marquage et démarquage par le seed, commandes `db:deleted:list` et
  `db:deleted:purge` avec simulation, confirmation et refus en production (DEC-4) ; écart résiduel
  Caddy documenté.
- **Résultat** : 315 unitaires, 544 e2e, 859 tests en couverture fusionnée à 100 %. Quatre fichiers
  de test existants modifiés, exactement ceux autorisés, un seul refus du garde-fou dans le journal.

## Lot 10 : pile locale complète avec Caddy

- **Décision** : pouvoir reproduire en local tout comportement de production, parité dev/prod.
- **Livré** : `pnpm stack:up`, `stack:ps`, `stack:logs`, `stack:down [--volumes]` montent sur le poste
  exactement la pile de production (même `compose.prod.yml`, même `Caddyfile`, même image), sans
  override compose ; seul `docker/.env.local` varie (modèle `.env.local.example`, mots de passe générés
  au premier lancement, jamais commité). Dix scénarios de reproduction documentés dans
  `docs/deploiement.md` (200 avec en-têtes, 405, 413, 404, 400 d'URL mal encodée, 301 HTTP→HTTPS, 429,
  502, rôle PostgreSQL en lecture seule, réseaux internes) et rejoués par deux fichiers e2e qui se
  déclarent absents sans pile et échouent avec `STACK_REQUIRED=1` ; job CI `pile-locale`. Tableau des
  écarts local/prod (certificat interne, ports, `alt-svc`).
- **Recette** : refusée une première fois faute d'autorisation « config » pour le job CI (oubli de
  l'orchestrateur, aucun contournement de l'agent), acceptée en seconde recette. Sur ce poste, le port
  8080 est pris par la V2 : ports surchargeables dans le fichier d'environnement local.

## Lot 11 : test par mutation, phase 1, mesure de référence

- **Décision** : la couverture à 100 % ne protège pas les assertions ; cadrage en trois phases validé.
- **Livré** : Stryker Mutator 10.1.1 épinglé, une configuration commentée par paquet, `pnpm
  test:mutation` (paquets et racine, hors `pnpm check`, hors pre-commit, hors CI pour cette phase),
  rapports dans `reports/mutation/` ignorés par git ; configurations Stryker et futur fichier de
  mutants équivalents protégés comme oracles par les hooks et le script d'intégrité (11 tests).
  Trois incompatibilités corrigées (chargement des greffons sous pnpm, racine de la sandbox, chemins
  du vérificateur TypeScript) et un défaut de Stryker identifié : l'option `testFiles` fausse la mesure
  des mutants statiques, donc on ne l'utilise pas.
- **Mesure** (Ryzen 7 3700X, 8 cœurs) : contrats 483 mutants, score 32,1 % en 3 min 38 ; API
  unitaires 1598 mutants, score 32,3 % (51 % sur le code couvert par les unitaires) en 8 min 41.
  Survivants des contrats : surtout des libellés du document OpenAPI (259) et 25 assertions faibles.
  Survivants de l'API : 239 ne peuvent être tués que par les e2e (schéma Drizzle, filtres `published`,
  constantes HTTP), 42 équivalents probables, 25 assertions faibles, 15 libellés, 8 branches
  défensives, plus 387 mutants sans couverture unitaire. Passage e2e sous Stryker estimé entre 2 et 3 h
  avec une base par processus, 11 à 16 h avec une seule base.
- **Phase 2 à cadrer** : portée de la règle (unitaires seuls d'abord), motifs d'exclusion à confirmer,
  seuil de rupture initial à 32, test d'instantané du document OpenAPI pour les contrats.

## Lot 12 : test par mutation, phase 2, la règle

- **Décision** : « aucun mutant survivant non justifié » sur le code atteignable par les unitaires ;
  un équivalent se déclare nominativement, une exclusion se motive, le seuil de rupture suit le score.
- **Livré par la qa** (tests seulement, aucun test existant touché) : test d'instantané du document
  OpenAPI généré (`document.snapshot.spec.ts`, `__snapshots__/openapi.json`, oracle protégé) et quatre
  fichiers sur les assertions faibles des contrats ; onze fichiers unitaires côté API (cas d'usage,
  bornes et protocoles de la configuration, lexeur SQL, runner de migrations, client Drizzle contre un
  faux serveur PostgreSQL, message du 503 de santé, problème sans `detail`). Contrats 104 → 133 tests,
  API 315 → 389 unitaires.
- **Livré par le lead-architecte** : neuf équivalents vérifiés un par un (le lexeur SQL par
  comparaison exhaustive) dans `apps/api/stryker.equivalents.json` (API-EQ-01 à 09 ; fichier vide côté
  contrats), deux exclusions par motif en greffons « ignorer » (métadonnées déclaratives du schéma
  Drizzle, 204 mutants, les noms de tables et colonnes restant mutés ; contexte de journal, 1 mutant),
  seuils de rupture 100 pour les contrats et 40 pour l'API, job CI « mutation » dédié (hors `pnpm
  check`, 45 min de marge, rapport HTML en artefact), script d'intégrité qui refuse toute directive
  `Stryker disable` sans Justification-test ou sans identifiant déclaré (8 cas shell, 5 cas hooks),
  prettier déclaré dans les contrats.
- **Scores** : contrats 32,06 % → 100 % (483 mutants, 0 survivant, 2 min 36) ; API unitaires
  32,33 % → 40,87 % total, 67,93 % sur le code couvert (1598 mutants, 374 tués, 186 survivants tous
  justifiés : 169 noms du schéma et 11 cas e2e en réserve de la phase 3, 6 équivalents déclarés ;
  384 sans couverture unitaire ; 7 min 37 à 9 min 52).
- **Recette** : renvoyée une fois (un mutant de `problem-details.ts` déclaré équivalent à tort par la
  qa, requalifié par le lead, tué par un test de la qa), puis acceptée : épreuve de mutation manuelle
  détectée par trois tests, test retiré au hasard sans effet sur la couverture signalé, onze
  scénarios de réserve contre le contrat, `pnpm check` vert sur clone neuf.
- **Points ouverts** : les hooks ne bloquent pas une directive `Stryker disable` (seul le script
  d'intégrité le fait) ; le contrôle Justification-test des directives est par fichier, pas par
  ligne ; durée réelle du job CI inconnue avant le premier push ; défaut latent `detailOf` sur une
  réponse `null`. Phase 3 (e2e sous Stryker) à cadrer.

## Lot 13 : git flow

- **Décision de Julien (19 nov. 2026, après le premier push)** : git flow. `develop` remplace
  `v3/backend` comme branche d'intégration ; la session principale, et elle seule, pousse `develop` ;
  les onze agents ne poussent jamais ; toute fusion dans `main` (`release/*`, `hotfix/*`), les
  étiquettes, le push de `main` et le déploiement sont réservés à Julien.
- **Livré** : le hook n'accepte plus que `git push [-u] origin develop` (avec `-C <chemin>`), pour la
  session principale ; tout le reste est refusé avec son motif (agents, force, suppression, `main`,
  étiquettes, refspec absente ou multiple, redéfinition de destination, alias). `.claude/settings.json`
  remplace le refus de tout push par des refus ciblés. Base du script d'intégrité et de la CI :
  `develop` ; CI déclenchée sur `develop`, `main`, `release/**`, `hotfix/**`, `lot/**` et les PR. Les
  scripts de déploiement refusent toute branche autre que `main`, sans surcharge possible. 69 tests de
  push ajoutés (115 tests de hooks).
- **Recette** : acceptée avec réserves, environ 115 formes de push rejouées. Trous hérités de
  l'analyseur de commandes, non introduits par le lot : push enveloppé dans un bloc (`{ }`, `if`, `for`,
  `!`, fonction), plomberie `send-pack` et `http-push`, redéfinition d'`origin` par `git remote set-url`
  ou `git config`, option `-c` collée, commandes `gh` qui fusionnent ou étiquettent côté GitHub. Plus un
  défaut de l'outil d'autorisation hors session (option `--path-format` inconnue du git 2.30 de l'hôte).
  Durcissement confié au lot suivant.

## Lot 13 bis : durcissement des refus de push et de l'analyseur de commandes

- **Livré** : l'analyseur de commandes des hooks devient récursif (blocs, `if`, boucles, `case`, `!`,
  fonctions, `coproc`, substitutions de processus, documents en ligne) et lit bash comme zsh ; principe
  « illisible donc refusé » sur toutes les règles (syntaxe incomplète, nom de commande ou cible d'écriture
  calculés, sous-commande git inconnue, script écrit et exécuté par la même commande). Refusés à tous les
  rôles : plomberie de push (`send-pack`, `http-push`, `git svn dcommit`, `git p4 submit`), redéfinition
  de la destination (`git remote set-url|add|rename|remove`, écritures `git config` sur `remote.*`,
  `url.*`, `push.*`, `include*`, édition des fichiers de configuration git), option `-c` collée et
  options globales non listées avec `git push`, commandes `gh` qui fusionnent, étiquettent, publient ou
  suppriment. Alias git résolus et analysés. Racine d'état corrigée pour le git 2.30 de l'hôte.
- **Mesure** : sur les 130 commandes de la recette du lot 13, 64 verdicts passent de permis à refusé ;
  un agent n'a plus aucune forme de push permise. 527 tests de hooks (115 avant), aucun test existant
  modifié.
- **Recette** : acceptée ; 88 commandes courantes de l'orchestrateur rejouées, toutes permises. Effet à
  connaître : une variable shell dans un chemin d'écriture est désormais refusée, les chemins s'écrivent
  en clair.
- **Décisions de Julien du même jour** : étiquette locale et déplacement local de `develop` restent
  permis ; toute écriture de la branche locale `main` sera refusée (lot 14, L14-06).

## Lot 15 : brief back-001 de la session front

- **Livré** (BF-1 à BF-7, un commit par ticket) : profil restructuré selon le design v6 (neuf champs
  `not null` et non vides, `headline`, `bio`, `availability` supprimés), `shownInStack` sur les
  compétences d'une expérience, `mainStackOrder` sur les compétences, lien des recommandations LinkedIn
  (lien social), ressources `/recommendations` et `/ai-overview` avec leurs clés dans `/cv`, contrat
  OpenAPI à 15 chemins. Migrations 0011 à 0016, docs/01 et README des contrats à jour.
- **Organisation** : trois étapes sur une seule branche (ajouts SQL, puis contrat et API par ticket, puis
  état final du profil), l'ordre « contrat d'abord, fusionné seul » du brief étant impossible avec le
  pre-commit. Première application de la portée « tests » des dev-* sous brief validé : 27 fichiers de
  test existants modifiés, chacun sous `Justification-test: BF-n`, aucune assertion affaiblie.
- **Mutation** : contrats 100 %, API 42,03 % (seuil 40, référence `develop` 40,77 %). Le 46,37 % mesuré
  en fin d'étape 2 n'est pas reproductible (35 timeouts comptés comme tués selon la charge) ; mesure
  rejouée 42,89 %.
- **Recette** : acceptée ; 36 scénarios de réserve joués contre l'API, aucun échec de l'API.
- **Écarts au brief** : BF-4 `published = true` (décision de Julien du 19 nov.), `cvPath` restreint à un
  chemin relatif au site, `mainStackOrder` aussi dans les compétences imbriquées de `/projects`, slugs des
  recommandations, libellés EN à relire (`docs/traductions-a-relire.md`).

## Lot 16 : briefs back-002 et back-003 (intégrité des tests, instantanés des hooks)

- **Livré** : BF-10, un fichier devenu oracle en cours de session (par une fusion) et resté identique au
  `head` de l'instantané n'est plus pris pour une création ; BF-11, l'instantané d'un worktree retiré est
  ignoré et supprimé, même si des fichiers générés recréent son dossier ; BF-8, chemins non ASCII et
  particuliers dans le script d'intégrité (`core.quotePath=false`, `-z`, `--literal-pathspecs`) ; BF-9,
  marqueur d'échec attendu reconnu sur les seules méthodes de l'API de test de Vitest, enchaînements
  multiples compris.
- **Trou corrigé** : avant BF-8, une configuration protégée ou un test au nom accentué se modifiait sans
  `Justification-test`.
- **Écart au brief** (BF-11) : un worktree encore listé par `git worktree list` garde son instantané et
  donne une violation unique ; retirer son `.git` ne suffit pas à couper la vérification de fin de tâche.
- **Recette** : acceptée ; sonde de 42 formes (ancien script contre nouveau), aucune forme refusée avant
  n'est acceptée. Points ouverts : saut enchaîné sur deux méthodes non détecté, fichier devenu test en
  cours de session éditable sans autorisation (`checkFileTool`), `git worktree prune` et `remove --force`
  non refusés aux agents.

## Lot 17 : brief back-004, lieu de l'expérience OpenClassrooms

- **Livré** (BF-12) : `location` nul pour `openclassrooms-mentor` en `fr` et en `en` (le mode de travail
  `remote` suffit, le front n'affiche plus « À distance, à distance ») ; ligne retirée de
  `docs/traductions-a-relire.md`. Recette acceptée : le nouveau test passe au rouge si le seed revient à
  « À distance ».

## Lot 14 : garde-fous, CI et optimisation des tests

- **Livré** (fusion e7607a4, recette acceptée avec réserves, `docs/comptes-rendus/lot-14-recette.md`) :
  e2e de l'API sur une base modèle recopiée et une base par processus, fichiers en parallèle (254 s →
  environ 20 s) ; `pnpm check` en une seule passe des tests, avec `format:check`, `husky:test`,
  actionlint et shellcheck par Docker (images épinglées par digest) ; Prettier au pre-commit sur les
  fichiers indexés ; mutation incrémentale sur `develop`, complète sur les étiquettes `v*` ; seuil de
  l'API relevé de 40 à 41 ; hooks : directives Stryker contrôlées dès l'écriture et à la ligne
  (identifiant cité, mutateur), `main` locale non inscriptible, marqueurs enchaînés, fichier devenu test,
  worktrees et branche suivie refusés aux agents ; section commune « Git et garde-fous » des quatorze
  fichiers d'agents.
- **Exécution** : deux branches en parallèle (`lot/14-garde-fous-ci`, `lot/14-hooks`), réunies avant
  recette ; F3a (front) fusionné dans la branche avant recette, conflit de `ci.yml` résolu.
- **Suites** : lot 18 (lecture de `core.hooksPath`, suivi de branche distante refusé aux agents) ;
  vérifications au premier run CI (cache de l'incrément, déclencheur `v*`, images, parallélisme) ;
  chemin critique de `pnpm check` côté front (F11).

## Transverse

- **Décisions prises en cours de route** : repli de langue par ligne ; adresse e-mail des commits
  acceptée (publique) ; soft delete partout ; 405 avec `Allow` ; `DENY` ; aucun écart fonctionnel
  dev/prod ; `/cv` en 404 sur base vide ; couverture 100 % ; test par mutation ; Remote Control et
  notifications mobiles activés.
- **Reste à faire** : passe de l'agent de revue sécurité « rien qui facilite une attaque » sur tout le
  dépôt et son historique avant le premier push ; contenu à compléter (liens sociaux, résumé
  Contentsquare, formation autodidacte, icônes devicon, tables projets, outils, ressources) ; 68
  traductions anglaises à relire ; après déploiement, adresse IPv6 vue par Caddy et domaine réel ;
  phase front à l'arrivée du design, avec les agents dev-front et revue-accessibilite.
