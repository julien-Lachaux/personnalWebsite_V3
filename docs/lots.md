# Les lots du chantier back-end V3

Synthèse, lot par lot, de ce qui a été fait depuis le 18 novembre 2026. Chaque lot a sa branche
`lot/N-nom`, un worktree isolé, un agent (ou deux) qui livre, une recette du chef de projet, puis une
fusion `--no-ff` dans `v3/backend` par l'orchestrateur. Le détail de chaque lot est dans
`docs/comptes-rendus/lot-N-*.md` ; les tickets et critères dans `docs/backlog.md` ; les décisions de
référence dans `docs/01` à `docs/03`. Rien n'est poussé sur GitHub à ce jour.

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
| 10 | Pile locale complète avec Caddy | dev-devops (agent du dépôt) | en cours | |
| 11 | Test par mutation, phase 1 | lead-architecte (agent du dépôt) | en cours | |

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

## Lot 10 : pile locale complète avec Caddy (en cours)

- **Décision** : pouvoir reproduire en local tout comportement de production, parité dev/prod.
- **Attendu** : une commande `stack:*` qui monte la même pile que la production (même compose, même
  Caddyfile, même image) sur le poste, scénarios de reproduction documentés et rejoués par des tests,
  job de CI, écarts local/prod listés.

## Lot 11 : test par mutation, phase 1 (en cours)

- **Décision** : la couverture à 100 % ne protège pas les assertions ; cadrage en trois phases validé.
- **Attendu** : Stryker Mutator 10.1.1 intégré au monorepo, mesure de référence sur les contrats et
  les unitaires de l'API, classement des survivants, estimation de la durée sur les e2e, aucune règle
  imposée à ce stade. Phase 2 : règle « aucun mutant survivant non justifié ». Phase 3 : e2e.

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
