# Compte rendu de fin de phase back-end V3 (point de contrôle 2)

Rédigé le 18 novembre 2026 par le chef de projet (ticket L6-05). Branche `v3/backend`, HEAD `4879eb7`,
129 commits, lots 0, 0 bis, 1, 2, 3 A, 3 B, 3 bis, 4, 5, 5 bis et 6 fusionnés en `--no-ff`. Aucun push.
Verdict : **recette finale verte**. La phase back-end attend la décision de Julien sur les points ouverts
ci-dessous.

## Livré

- **API de contenu en lecture seule** (NestJS 12.5.1 sur Fastify 5.12.8, ESM, architecture hexagonale) :
  préfixe `/api/v1`, 12 ressources `GET` (`profile`, `social-links`, `skill-groups`, `skills`, `experiences`,
  `projects`, `tools`, `resources`, `certifications`, `education`, `languages`, `cv`), `?lang=fr|en`
  (défaut `fr`, repli sur `fr`), plus `GET /api/v1/health` et `GET /api/v1/docs.json`.
- **Contrat OpenAPI 3.2.0** (`info.version` 1.0.0) généré depuis les schémas Zod 4 de `packages/contracts`
  (13 chemins, 22 schémas nommés), servi par l'API et exporté dans `packages/contracts/dist/openapi.json`.
  Les contrôleurs valident leurs réponses contre ces schémas ; un test Ajv vérifie la conformité.
- **Erreurs RFC 9457** `application/problem+json` : 400 (`lang` invalide, URL mal encodée), 404 (route
  inconnue, méthode non déclarée), 413 (corps > 1 Kio), 429 (rate limiting), 500 et 503 au détail générique.
- **Schéma SQL** : 9 migrations manuelles (`db/migrations`, runner maison avec checksum, refus des migrations
  renommées, absentes ou contenant un contrôle de transaction), 25 tables (13 entités ou liaisons, 11 tables de
  traduction, `schema_migrations`), schéma Drizzle dérivé et testé contre le SQL.
- **Contenu** : 5 seeds idempotents (convergence par `xmin`, une transaction, contrôle de traduction `fr`) :
  1 profil, 1 lien social, 7 groupes, 34 compétences, 8 expériences (37 liaisons), 3 certifications,
  3 formations, 2 langues ; `projects`, `tools`, `resources` vides. 68 traductions EN marquées « à relire ».
- **Sécurité** : helmet, CORS limité à `CORS_ORIGIN` et à `GET, HEAD, OPTIONS`, rate limiting global par IP
  (100 requêtes par minute par défaut, 404 et préflights comptés), `TRUST_PROXY` en liste explicite, délais
  SQL et HTTP bornés, aucune donnée de contact en base ni dans les réponses.
- **Production** : image Docker multi-stage (utilisateur non root, sans npm, yarn, wget, nc ni `db:reset`),
  `docker/compose.prod.yml` (Caddy, API, service `migrate`, PostgreSQL 16 ; réseaux `edge`, `app` et `data`
  internes ; conteneurs en lecture seule, `cap_drop: ALL`, limites mémoire et processus ; images épinglées par
  digest), rôle PostgreSQL `siteperso_api` en lecture seule, Caddyfile (TLS automatique, 405 sur les méthodes
  d'écriture, corps plafonné à 1 Kio, CSP, sans `Server` ni `Via`), scripts `first-install.sh`, `update.sh`
  (sauvegarde d'abord), `backup.sh`, documentation `docs/deploiement.md`.
- **Qualité** : TypeScript strict, ESLint, Prettier, hook pre-commit (lint, typecheck, unitaires), CI GitHub
  Actions (actions épinglées par SHA, `pnpm audit`, passe e2e en ordre aléatoire), Dependabot.
- **Tests** : 104 tests de contrats, 275 unitaires API, 473 e2e API contre PostgreSQL Docker, aucun
  `it.fails`, `.skip`, `.only` ni `.todo`.
- **Outillage** : Node 26.13.1 téléchargé par pnpm (`.npmrc`), pnpm 10.34.9 (`packageManager`), rien
  d'installé globalement.

## Non livré

- Front Nuxt (`apps/web`) : différé au design, hors phase. Caddy sert une page d'attente sur `/`.
- Contenu de `projects`, `tools`, `resources` (routes vides `[]`), liens `github` et `website` de
  `social_links` : aucune donnée source.
- Fichiers images (portrait, 7 logos) : à fournir par le front ; seuls les chemins sont en base.
- RC-7 (repli de langue), RS-10 (adresse des commits), politique des entités retirées des seeds : décisions
  de Julien attendues, aucun code modifié.
- CI jamais exécutée sur GitHub (aucun push) ; certificat ACME de production jamais testé (seul le
  certificat interne `localhost` l'a été) ; relevé IPv6 sur le VPS (RS-4) non fait.
- Pas de test de charge ni de concurrence.

## Décisions

Décisions prises en cours de route et appliquées (détail dans `docs/comptes-rendus/` et `docs/revues/`) :

- Versions : Node 26.13.1 (dernière ligne stable), pnpm 10.34.9 (le 9.0.0 de départ est visé par des avis de
  sécurité), TypeScript 6.0.3 (la 7.x existe mais `typescript-eslint` exige `< 6.1`), PostgreSQL 16 comme
  `docs/02`.
- Propriétés JSON en camelCase ; objets de réponse stricts (`additionalProperties: false`).
- Une image n'est exposée que si chemin ET texte alternatif sont présents, sinon `null` ; chemins et alt vides
  interdits en SQL (migration `0008`).
- URL limitées à `http`/`https` dans les contrats et en SQL (migration `0009`).
- `SkillGroup.description`, `Education.description` et `Project.year` nullables, comme en SQL.
- `/skills` à plat conservé à côté de `/skill-groups` imbriqué ; `/cv` agrège 10 cas d'usage (compétences
  imbriquées dans `skillGroups`, pas de `skills` à plat).
- Tri des expériences : `date_start` décroissant, puis `sort_order` ; ailleurs `sort_order`.
- `lang` strict en minuscules (`EN`, `de`, vide ou répété : 400).
- Repli de langue champ par champ (`coalesce(en, fr)`), y compris pour les champs nullables.
- Seeds : convergence par `xmin` (traductions et liaisons absentes du fichier supprimées), entité retirée
  signalée mais conservée, slug inconnu = erreur et annulation.
- Rate limiting par hook `onRequest` racine ; CORS par `@fastify/cors` ; `OPTIONS` sans `Origin` = 204.
- Caddy répond lui-même 405 (problem+json) et 413 (texte) sous `/api/*`.
- Rôle `siteperso_api` en `select` seul, créé par le service `migrate` ; `API_DB_PASSWORD` obligatoire.
- `husky` activé (docs/02 le disait facultatif) ; e2e par `app.inject`, sans supertest.
- Couverture unitaire (lignes 85 %, branches 75 %) mesurée hors code qui exige PostgreSQL (dépôts, runners
  SQL, modules Nest), exercé par les e2e.

## Points ouverts

Pour Julien, chacun avec le choix appliqué aujourd'hui par défaut :

| Sujet | Défaut appliqué aujourd'hui |
|---|---|
| RC-7 : repli de langue par champ ou par ligne | Par champ : un `logo_alt` EN nul donne un alt français dans une réponse EN ; un `achievements` EN vide (`'{}'`) masque le français. À inscrire dans `docs/01` une fois tranché. |
| RS-10 : adresse e-mail personnelle dans les métadonnées (auteur et committer) des 129 commits | Inchangée. À réécrire par `git filter-repo --mailmap` (vers une adresse `noreply`) avant le premier push, ou à accepter. Aucune référence distante n'existe encore. |
| Entités retirées des seeds | Signalées (`ATTENTION …` au rejeu) et conservées en base ; options : suppression ou `published = false`. |
| RS-4 : IP vue par Caddy pour les visiteurs IPv6 sur le VPS | Non relevée. Procédure dans `docs/deploiement.md` ; en local (WSL), Caddy voit `172.29.0.1` pour tous les clients, comme documenté. |
| `X-Frame-Options` `SAMEORIGIN` ou `DENY`, CSP | Livré après RS-12 : `X-Frame-Options: SAMEORIGIN` (helmet et Caddy) ; CSP posée par Caddy seulement, `default-src 'none'; frame-ancestors 'none'` sous `/api/*` et `default-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'` sur la page statique ; l'API seule n'envoie pas de CSP. |
| 404 ou 405 sur une méthode non déclarée | API seule : 404 problem+json (« Cannot POST … »). Derrière Caddy en production : 405 problem+json avec `Allow: GET, HEAD, OPTIONS`. |
| `/cv` sur base vide | 404 problem+json (profil absent), pas de CV partiel. |
| 68 traductions EN à relire (`docs/traductions-a-relire.md`) | Servies telles quelles en `?lang=en`. Voir la recette, étape 8, pour les tournures à revoir en priorité. |
| Résumé Contentsquare | Rédigé par l'agent base de données à partir des réalisations (le CV n'en donne pas) : à valider. |
| Formation autodidacte | Début 2015 par défaut, fin nulle ; `institution` « Autodidacte » non traduite (identique en EN). |
| Icônes devicon | Slugs non vérifiés en ligne (`streamsets`, `posthog`, `magento`…) ; `icon_path` nul partout. |
| Logos et portrait | À fournir par le front : `/images/profile/portrait.jpg`, `/images/logos/<slug>.svg` (Wynd en double). |
| `social_links` | Seul LinkedIn est seedé ; `github` et `website` attendent leurs URL. |
| `projects`, `tools`, `resources` | Tables créées, vides ; routes `[]`. |
| pnpm 10 sur l'hôte | L'hôte a pnpm 9.0.0, refusé par `engines.pnpm >= 10.34.5`. À installer par `pnpm self-update 10.34.9` ou par corepack, au choix ; puis réinstallation propre (`rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`). La recette a utilisé une copie locale de pnpm 10.34.9. |
| Changements de contrat visibles par le front | `SkillGroup.description`, `Education.description` : `string \| null` ; `Project.year` nullable ; toutes les URL limitées à `http`/`https` (`mailto:`, `tel:`, `javascript:` refusés). `info.version` reste 1.0.0 (aucun client publié). |
| Seuil de rate limiting | 100 requêtes par minute par IP, store en mémoire (une instance) ; réglable par `RATE_LIMIT_MAX` et `RATE_LIMIT_WINDOW_MS`. |
| Texte brut ou Markdown léger (P7) | Texte brut ; paragraphes de `bio` séparés par une ligne vide. |
| Domaine de production (P10) | Placeholders `example.test` dans `docker/.env.prod.example`. |

## Dette

- Couverture : les runners SQL (`migrations-runner`, `seeds-runner`, `seeds-convergence`,
  `provision-api-role`, `reset-database`), les dépôts Drizzle et `create-app.ts` sont hors seuil unitaire,
  couverts seulement par les e2e.
- `frameworkErrors` (URL mal encodée, ex. `/api/%zz`) n'est pas compté par le rate limiting et sa réponse
  ne porte qu'une partie des en-têtes de sécurité (ni HSTS ni `x-ratelimit-*`) ; derrière Caddy, la même URL
  est rejetée par Caddy lui-même (400 `text/plain` en HTTP/1.1, `PROTOCOL_ERROR` en HTTP/2), hors
  problem+json.
- Compose de dev et services PostgreSQL de la CI non épinglés par digest ni durcis (RS-7 et RS-9 ne visaient
  que la production).
- Messages d'erreur produits par le framework en anglais (« Cannot GET … », « Rate limit exceeded… », « … is
  not a valid url component ») alors que la convention est le français ; la réponse 429 ne porte que
  `X-Content-Type-Options` parmi les en-têtes helmet.
- Bornes du contrat plus strictes que le SQL sans `check` correspondant (`Education.yearStart`/`yearEnd`,
  `Project.year`, chaînes non vides de plusieurs colonnes) : une donnée hors bornes donnerait un 500 générique.
- `image_alt` unique pour les captures desktop et mobile d'un projet (docs/01).
- Les e2e codent en dur les effectifs et quelques slugs du seed (`test/support/endpoints.ts`) : tout changement
  de contenu est à répercuter.
- `pnpm dev` et les CLI `db:*` affichent `DEP0205` (`module.register()` déprécié sous Node 26) via
  `@swc-node/register` 1.12.1 : sans effet aujourd'hui, à suivre.
- L'image de production est étiquetée `siteperso-api:prod` en dur : deux piles sur un même hôte partagent
  l'étiquette.
- La section « Essai local de la pile de production » de `docs/deploiement.md` ne passe pas
  `API_DB_PASSWORD`, devenu obligatoire : la commande échoue telle quelle (`API_DB_PASSWORD requis`).
- `docs/backlog.md` contient des mentions périmées (`@types/node` 22.20.5 en section 9, `TRUST_PROXY=true`
  en R12, `packageManager: pnpm@9.0.0` dans L0-01) ; `docs/01` et `docs/02` ne reflètent pas encore les
  écarts ci-dessous.
- Le store de rate limiting est en mémoire : à revoir si l'API passe à plusieurs instances.

## Écarts avec docs/01 et docs/02

- **docs/01** : tables, colonnes et routes conformes. Écarts volontaires : `/health` et `/docs.json` sous le
  préfixe `/api/v1` ; `education.institution` non traduit (« Autodidacte » en EN) ; repli `fr` champ par
  champ (le document ne précise pas) ; image `null` sans texte alternatif ; checks SQL ajoutés (alt et chemins
  non vides, URL `http`/`https`) ; tri des expériences par `date_start` décroissant puis `sort_order`, comme
  docs/01 l'indique pour cette table ; aucune ligne `projects`/`tools`/`resources`.
- **docs/02** : briques conformes (Node 26, NestJS sur Fastify, PostgreSQL 16, Drizzle + `postgres`, SQL
  manuel, Zod, OpenAPI 3.2.0 par `zod-to-openapi`, Vitest, Docker multi-stage, Caddy). Écarts : `app.inject`
  sans supertest ; husky activé ; compose de prod sans service `web` (front différé) ; CSP posée par Caddy et
  non par helmet ; pnpm épinglé en 10.34.9 ; TypeScript 6.0.3 et non 7.x (contrainte `typescript-eslint`).

## Recette finale

Depuis un clone propre de `v3/backend` (HEAD `4879eb7` vérifié), pnpm 10.34.9, Node 26.13.1 téléchargé par
pnpm, conteneurs isolés (`siteperso-v3-recette-finale` sur 5612/5613, API sur 3612 ;
`siteperso-v3-recette-prod` sur 8612/8613).

1. `pnpm install --frozen-lockfile` : vert (279 paquets).
2. `pnpm db:up && pnpm db:migrate && pnpm db:seed` : 9 migrations, 5 seeds. Second `pnpm db:seed` puis un
   troisième : effectifs des 24 tables identiques (idempotence). `pnpm db:reset` : schéma recréé, migrations
   et seeds rejoués.
3. `pnpm build` : vert (contrats puis API).
4. `pnpm check` : vert, 8 tâches turbo. Contrats 104 tests (17 fichiers), API 275 unitaires (27 fichiers),
   473 e2e (31 fichiers, 64 s). Aucun `it.fails`, `.skip`, `.only`, `.todo` dans le dépôt.
5. API (`pnpm start`) : `/api/v1/health` et `/api/v1/docs.json` 200 ; les 12 ressources 200 en `fr` et en
   `?lang=en`, contenu anglais présent ; `projects`, `tools`, `resources` = `[]`. `?lang=de` : 400
   problem+json ; URL inconnue : 404 problem+json ; `OPTIONS` nu : 204 ; `/api/%zz` : 400 problem+json ;
   `POST /api/v1/profile` et `DELETE /api/v1/skills` : **404** problem+json. Rate limiting : sur 110 requêtes,
   60 x 200 puis 50 x 429 problem+json avec `retry-after` (quota de 100 entamé par les requêtes
   précédentes). `Content-Type` `application/json` ou `application/problem+json` partout ; en-têtes helmet
   présents (HSTS, `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, COOP, CORP),
   pas de `x-powered-by`. API arrêtée.
6. Pile de production (L5-02) par `scripts/deploy/first-install.sh` (`DEPLOY_DIR` temporaire) : premier passage
   code 10 et `.env.prod` en 600 avec mots de passe générés, second passage code 0, API `healthy`. Le service
   `migrate` applique 9 migrations, 5 seeds et crée `siteperso_api` (non superutilisateur, `select` sur les
   25 tables, aucun `insert`/`update`/`delete`/`truncate` ; `insert`, `update`, `delete`, `create table`,
   `drop table` et `copy … program` refusés). Via Caddy en HTTPS : `/api/v1/profile` 200 (FR et EN),
   `POST` et `PUT` 405 problem+json avec `Allow`, `OPTIONS` 204, `GET` avec corps de 2 Kio 413, 105 requêtes
   donnent 95 x 200 puis 10 x 429, redirection HTTP 301 vers HTTPS. Aucun `Server` ni `Via` (réponses API,
   `HEAD`, redirection). CSP présentes comme décrit plus haut. `/api/%zz` rejeté par Caddy hors problem+json
   (voir Dette). Pile arrêtée par `down -v`.
7. `docs/traductions-a-relire.md` : 68 lignes, autant que de marqueurs `-- EN : à relire` dans les seeds
   (5 + 14 + 38 + 11). Tournures à revoir en priorité : « Available for missions » (plutôt « Available for
   freelance assignments »), « Company reference for StreamSets » (plutôt « Company-wide StreamSets lead »),
   « Self-taught training » (plutôt « Self-taught »), « RUN team » (jargon français, plutôt « Run (operations)
   team »), « Web Integrator » (intitulé du parcours à vérifier en anglais). Côté français : « Logo de
   Afluens » et « Logo de OpenClassrooms » appellent l'élision (« d'Afluens », « d'OpenClassrooms »).
8. Données personnelles : aucune adresse e-mail hors `noreply` et domaines réservés (`example.com`,
   `example.test`), aucun numéro de téléphone hors placeholder `tel:+33100000000` dans les fichiers suivis ni
   dans les diffs de l'historique. Seule exception connue : l'adresse personnelle des métadonnées de commit
   (RS-10). Le seed contient prénom, nom, ville et URL LinkedIn publique, contenu voulu du site.
9. `git status --porcelain` du clone vide à la fin (seuls les fichiers ignorés `.env`, `dist/`,
   `node_modules/`).

## Coût

- Lot 6 (corrections) : 5 agents, 981 975 tokens de sous-agents, 1 h 53.
- Lots 0, 0 bis, 1, 2, 3 A, 3 B, 3 bis, 4, 5, 5 bis, revues et triage : durée et tokens inconnus du chef de
  projet (non relevés dans les comptes rendus).
- Recette finale (ce ticket) : non mesurée par l'agent.
