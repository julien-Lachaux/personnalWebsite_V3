# Lot 6 : corrections (agent corrections)

Branche `lot/6-corrections`, dérivée de `v3/backend`. Source : `docs/revues/triage-2026-11-18.md` (26
entrées). Un commit par finding, sujet préfixé par ses identifiants. `pnpm check` vert avant chaque commit.
Vérification finale : `docker compose down` puis `pnpm check` deux fois de suite sur base de test neuve,
les deux verts (contrats 104, unitaires API 265, e2e API 473, plus aucun `it.fails`).

Outil : pnpm 10.34.9 (RS-2) a été utilisé depuis une copie dans le dossier temporaire de l'agent
(`npm i pnpm@10.34.9`, rien d'installé globalement). Le pnpm 9.0.0 de l'hôte refuse désormais le dépôt
(`engines.pnpm >= 10.34.5`) : Julien doit installer pnpm 10 (voir Points ouverts).

## Fait, par finding

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| RC-1 | `1f78f4a` | `globalSetup` (`test/support/global-setup.ts`) recrée la base (migrations + seeds) avant le premier fichier ; `resetTestDatabase()` ajouté au `beforeAll` des 6 fichiers qui dépendaient d'un autre (les 5 cités + `harness`) ; seconde passe CI `--sequence.shuffle.files`. | `docker compose down` puis `pnpm check` vert deux fois ; passe en ordre de fichiers aléatoire verte. |
| RC-2 | `20325b0` | Les compétences des projets passent par `selectPublishedSkills(...).innerJoin(projectSkills)`, comme `experiences` : groupe publié exigé. `ProjectSkill` supprimé au profit de `Skill`. | Test e2e « groupe non publié » étendu aux projets, aux expériences et à `/cv`. |
| RC-3 | `a97c9fa` | Un seul `toImage` (`application/common/image.ts`, null et chaîne vide) ; migration `0008` : `check <> ''` sur 9 colonnes de chemins et d'alt d'images. | Spec `toImage`, e2e des contraintes SQL. Traite aussi « alt d'images nullables en SQL mais exigés par le contrat ». |
| RS-3 + BUG-3 | `ff54295` | Hook `onRequest` racine pour le rate limiting (404 et préflights comptés) ; CORS enregistré par `@fastify/cors` après lui (le hook de Nest 12 répondait aux préflights avant) ; `bodyLimit` 1024 (413 problem+json) ; Caddy : 405 sur les méthodes d'écriture et `request_body max_size 1KB`. | Tests : 429 sur 404 et sur préflights, 413 (corps de 2 Kio, chunked), 404 sur petit corps ; Caddy validé et testé en vrai (405, 413). `BUG-3` devient un test vert. |
| RS-1 | `aa33ef1` | Rôle `siteperso_api` (select seul, privilèges par défaut) créé par le service `migrate` (`provision-api-role`) ; `DATABASE_URL` de l'API sur ce rôle ; `API_DB_PASSWORD` généré par `first-install.sh` et `update.sh`. | Test e2e (`has_table_privilege` INSERT faux, `copy program` refusé) ; pile prod : `rolsuper` faux, `copy from program` refusé, `drop table` refusé. |
| RS-2 | `fa3aa3f` | pnpm 10.34.9 dans `packageManager`, `engines.pnpm >= 10.34.5` et Dockerfile ; `pnpm deploy --legacy` (exigé par pnpm 10) ; `onlyBuiltDependencies: [@swc/core, esbuild]` ; `pnpm audit --prod --audit-level=high` en CI. | `pnpm audit` : aucune vulnérabilité ; `docker build` et `pnpm check` verts sous pnpm 10. |
| RC-4 | `2595ab9` | Seeds en une transaction, instruction par instruction ; traductions et liaisons non réécrites (xmin de la transaction) d'une entité écrite par les seeds supprimées ; instruction d'écriture sans ligne touchée = erreur ; listes `values` jointes en `left join` ; entité retirée signalée. | Tests : md5 de chaque table avant et après rejeu, liaison ajoutée à la main, seed retiré, slug inconnu (annulation complète). |
| RS-11 | `a37ecbf` | `BACKUP_KEEP` validé (`^[1-9][0-9]*$`) ; `update.sh` sauvegarde d'abord (`SKIP_BACKUP=1` pour sauter) ; `reset.js` et `reset-database.js` retirés de l'image ; copie hors VPS documentée. | Tests `deploy-scripts.e2e-spec.ts`. |
| RC-11 | `75c9f2d` | Contrôle en fin de `runSeeds` : toute ligne publiée (et le profil) a une traduction `fr`, sinon erreur et annulation. | Test e2e (`qa-sans-fr`). |
| RC-8 | `8673cfd` | Le runner refuse une migration appliquée renommée (même version, autre nom) ou absente du disque. | Deux cas e2e. |
| RC-9 | `ff49702` | Fichier de migration refusé s'il contient `begin`, `commit`, `rollback`, `start`, `end`, `abort` (hors commentaires, chaînes, corps de fonction) ; documenté dans `db/README.md`. | Six cas e2e plus un cas accepté. |
| RS-5 | `a21a6c3` | `TRUST_PROXY` = `false` ou liste d'IP, CIDR ou plages nommées (`uniquelocal`…) ; `true` refusé ; compose de dev `false`, prod `uniquelocal`. | Tests de configuration et e2e (proxy listé, pair hors liste, en-tête falsifié). |
| RS-6 | `97e8c64` | `connect_timeout` 5 s, `idle_timeout` 60 s, `statement_timeout` 5 s, ping borné à 2 s, `requestTimeout` et `handlerTimeout` 10 s ; `FST_ERR_HANDLER_TIMEOUT` rendu en 503 problem+json ; `DB_STATEMENT_TIMEOUT_MS` et `HANDLER_TIMEOUT_MS` configurables. | Serveur TCP figé (ping), table verrouillée (503 et 500 sans fuite). |
| RS-8 | `1865d05` | `HttpUrlSchema` (http et https seulement) sur 8 champs de 7 contrats ; migration `0009` : `check (url ~* '^https?://')` sur 8 colonnes. | Tests contrats et SQL (`javascript:`, `data:`, `mailto:`, `tel:`, `ftp:`). |
| BUG-1 | `250dc9c` | `frameworkErrors` rend les erreurs d'avant le routage en problem+json 400 avec en-têtes de sécurité. | Le test `BUG-1` passe de `it.fails` à `it`. |
| BUG-2 | `5a97d69` | `strictPreflight: false` : OPTIONS nu répond 204. | Le test `BUG-2` passe de `it.fails` à `it`. |
| KN-SkillGroup.description | `163ecac` | `description` nullable dans le contrat et l'OpenAPI ; `translated` à la place de `translatedOrEmpty` (supprimé). | Specs contrat, cas d'usage, e2e (`null` renvoyé). |
| RS-12 | `f3ed956` | `Server` et `Via` retirés (redirection HTTP écrite à la main, `handle_errors`, `-Via`) ; CSP `default-src 'none'; frame-ancestors 'none'` sous `/api/*`, CSP `'self'` sur la page statique. | Vérifié sur la pile de production isolée. |
| RC-5 | `710eb4a` | `http/common/locale-query.ts` (`parseLocaleQuery`, un seul message) ; validation de réponse en une forme ; `CvSchema.parse` retiré du cas d'usage. | Specs `controllers` et `locale-query`. |
| RC-10 | `8c8bb37` | Les 11 dépôts sans `@nestjs/common`, câblés par `useFactory` + `inject` ; `architecture.spec.ts` étend le contrôle D8 à `infrastructure/db`. | `grep -rln "@nestjs" infrastructure/db` : seul `database.module.ts`. |
| RC-6 | `8c033a7` | `translated` typé depuis la colonne (`ColumnValue`), `translationAliases(table)`, `text('cefr_level', { enum })` sans cast. | `tsc` ; spec de type et de SQL. |
| RS-7 | `0243b10` | Réseaux `edge`, `app` et `data` (les deux derniers `internal`) ; `read_only` + `tmpfs`, `cap_drop: ALL`, `no-new-privileges`, `mem_limit`, `pids_limit` ; `COPY` sans `--chown` ; npm, yarn, corepack, `wget`, `nc` retirés de l'image. | Pile isolée : Caddy ne résout pas `postgres`, l'API n'a pas de sortie, `touch dist/main.js` refusé ; `prod-compose.e2e-spec.ts`. |
| RS-4 | `9113897` | Journal d'accès JSON de Caddy (rotation 3 x 10 Mo), `ipv6Subnet: 64` explicite, procédure de vérification dans `docs/deploiement.md`. | Journal vérifié sur la pile isolée ; **le résultat sur le VPS reste à relever**. |
| RS-9 | `b01c414` | 7 `uses:` épinglés par SHA, images `caddy`, `postgres`, `node` par `@sha256`, `.github/dependabot.yml`. | Test sur les SHA et digests. |

## Non fait et pourquoi

- **RC-7** (repli de langue par champ ou par ligne) : décision de Julien requise, à inscrire dans `docs/01`
  (hors périmètre de l'agent). Aucun code modifié. Comportement actuel inchangé : alt français dans une
  réponse EN quand `logo_alt` EN est nul, `achievements` EN vide `'{}'` qui masque le FR.
- **RS-10** (adresse personnelle dans les 100 commits) : décision de Julien, et la correction réécrit
  l'historique (`git filter-repo --mailmap`), opération destructrice qu'un agent ne lance pas. Aucune
  référence distante n'existe : il est encore temps avant le premier push.
- **RC-4, volet « entité retirée des seeds »** : seules les liaisons et les traductions sont supprimées
  automatiquement. Une entité (ligne parente) retirée des fichiers est signalée (`ATTENTION …`) mais
  conservée : suppression ou dépublication est une politique à valider par Julien.

## Décisions

1. **Seeds : convergence par `xmin`** plutôt que par réécriture des 938 lignes de seeds en CTE. Les lignes
   que `insert … on conflict do update` écrit portent l'identifiant de la transaction ; le reste des lignes
   dépendantes d'une entité écrite est supprimé. Même effet que le CTE proposé, sans toucher au contenu.
2. **Seeds : slug inconnu** détecté par le runner (instruction d'écriture qui touche 0 ligne) et, pour les
   trois listes `values` jointes, par `left join` (violation de `not null`). Convention documentée dans
   `db/README.md`.
3. **`TRUST_PROXY`** : un nombre de sauts n'est pas retenu, Fastify 5.12 le refuse volontairement (fail
   closed). `true` est refusé par la configuration. Prod : `uniquelocal` (Caddy est le seul pair privé de l'API).
4. **CORS enregistré par `@fastify/cors`** et non par `app.enableCors()` : le hook de Nest 12 répond aux
   préflights avant le rate limiting et helmet.
5. **Rate limiting par hook `onRequest` racine** (`global: false` du plugin) : seul moyen de compter les 404
   et les préflights sans réécrire le gestionnaire 404 de Nest.
6. **Caddy répond lui-même 405 et 413** (`text/plain` pour le 413) : le but est de ne pas lire de corps, pas
   un format. L'API garde son 413 problem+json (corps limité à 1 Kio).
7. **pnpm 10.34.9** (dernier 10.x) plutôt que 11 ou 12 : plus petit saut depuis 9, correctif de sécurité
   présent. `pnpm deploy --legacy` plutôt que `inject-workspace-packages`.
8. **`API_DB_PASSWORD` obligatoire** dans `.env.prod` : `update.sh` le génère s'il manque.
9. **Pile de dev** : `docker-compose.yml` (dev) et les services PostgreSQL de la CI ne sont ni épinglés ni
   durcis (hors périmètre de RS-7 et RS-9, qui visent la production).

## Points ouverts

- Julien : installer pnpm >= 10.34.5 sur l'hôte (le 9.0.0 est refusé par `engines.pnpm`) ; `docs/02` et
  `docs/backlog.md` citent encore pnpm 9 (fichiers hors périmètre).
- Julien : trancher RC-7 (repli par ligne ou par champ), RS-10 (adresse noreply ou acceptation), et la
  politique des entités retirées des seeds (supprimer ou dépublier).
- Front : `SkillGroup.description` devient `string | null` (changement de contrat, `info.version` inchangée
  à 1.0.0) ; `javascript:`, `mailto:` et `tel:` ne sont plus acceptés dans les URL de l'API.
- Déploiement : relever après le premier déploiement l'adresse IPv6 vue par Caddy (RS-4, procédure dans
  `docs/deploiement.md`) ; un déploiement existant exécute `update.sh`, qui sauvegarde d'abord, génère
  `API_DB_PASSWORD`, puis crée le rôle de lecture seule.
- `docker compose` (prod) : les conteneurs sont en lecture seule ; si une future dépendance a besoin d'écrire
  hors `/tmp`, ajouter un `tmpfs` ou un volume.
- Non mesuré : un déni de service par flot d'URL à pourcentage invalide (`frameworkErrors`) n'est pas
  compté par le rate limiting (réponse minuscule, aucun accès base, Caddy borne le reste).
- Dérive possible : `AssertionError` des seuils de couverture inchangés (lignes 85, branches 75) ; les
  nouveaux modules SQL (`seeds-convergence`, `provision-api-role`) sont exercés par les e2e, hors couverture
  unitaire comme les autres runners.
