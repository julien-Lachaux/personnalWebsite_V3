# Lot 33 : production tout statique (dev-devops)

Date : 25 novembre 2026. Branche `lot/33-prod-statique` (depuis `develop` b608b6d). Carte Trello 63.
Isolation : projet `siteperso-v3-lot33`, PostgreSQL 5962/5963, Playwright 5960, site e2e 5961.
Décision de Julien du 25 nov. 2026 : le site n'appelle jamais l'API, qui ne sert qu'à le fabriquer ; plus d'API
ni de base sur le VPS.

## Commits

1. `feat(deploy)` : `scripts/deploy/build-site-archive.sh` (archive `site-<version>.tar.gz` + somme, CI).
2. `feat(deploy)` : job `site` de `.github/workflows/release.yml` (Justification-test L33, autorisation config).
3. `feat(deploy)` : `scripts/deploy/deploy-static.sh`, `docker/compose.vps-static.yml`, `docker/Caddyfile.vps-static`,
   tests `deploy-static.e2e-spec.ts` (21) et `prod-static.e2e-spec.ts` (10).
4. `docs` : `docs/deploiement.md` (« Production tout statique »), `docs/02-stack-technique.md`, `docker/.env.prod.example`.
5. Ce compte rendu.

## Fait

- **Génération en CI** : après l'étiquetage (même workflow, `needs: etiquette`, sortie `version`), PostgreSQL de service,
  migrations et seeds, API, `nuxt generate` contre l'API, contrôle des pages (accueil, en, 404, 50x), relevé `csp.caddy`,
  archive déterministe (`public/`, `csp.caddy`) et somme SHA-256 jointes à la release (`gh release upload --clobber`,
  job rejouable). Valeurs publiques : variables de dépôt, échec avant toute génération si elles manquent. Prouvé en vrai
  (hors GitHub) : migrations + seeds + API réelle sur le PostgreSQL de test puis `build-site-archive.sh` : 21 routes
  prérendues, CSP relevée (13 pages), archive et somme écrites.
- **Déploiement VPS** (`deploy-static.sh <X.Y.Z>` / `--rollback [X.Y.Z]`) : téléchargement HTTPS (file:// pour essai),
  somme vérifiée AVANT extraction, contrôle des entrées de l'archive (seulement `public/`, `csp.caddy`, pas de `..`),
  pages attendues, bascule atomique de `current`, trois versions gardées (tri sémantique, la version active jamais
  supprimée), `compose up -d` + `caddy reload`, copie des pages de secours (50x, `_nuxt`, `fonts`, `csp.txt` = valeur seule
  extraite de `csp.caddy` sans conteneur). Refuse un dépôt hors `main` (comme les autres scripts).
- **Pile statique** : `docker/compose.vps-static.yml` autonome (un seul service, Caddy ; aucun port ; site monté en
  lecture seule ; durcissement du lot 29 repris) et `docker/Caddyfile.vps-static`. `compose.prod.yml`, `compose.vps.yml`,
  `Caddyfile`, `Caddyfile.vps` inchangés : la synchro imposée par `prod-vps.e2e-spec.ts` reste vraie.
- **Docs** : voir commit 4.

## Décisions

- **`/api/*` : 410 (Gone) en problem+json**, toute méthode, sans amont : l'API a existé et est retirée volontairement ; 404
  laisserait croire à une adresse mal écrite, 405 à une méthode à changer.
- **Nouveau Caddyfile** plutôt qu'une variante conditionnelle : le bloc `/api/*` diffère. `prod-static.e2e-spec.ts` borne
  l'écart : le fichier est identique à `Caddyfile.vps` hors bloc `/api/*` (corps comparé après retrait de ce bloc).
- **Montage du dossier `site/` (parent de `current`)** et non du lien `current` : un montage de lien est résolu à la
  création du conteneur et resterait sur l'ancienne version après une bascule.
- **Compose autonome** (pas une surcharge) : une surcharge ne peut pas retirer des services.
- **Variables de dépôt, pas des secrets** : ces valeurs finissent dans les pages publiques. Noms : `SITE_CONTACT_EMAIL`,
  `SITE_BASE_URL`.
- Pages de secours de l'hôte : copie ignorée avec avertissement si `STATIC_ERRORS_DIR` n'existe pas (premier déploiement
  avant que l'administrateur crée le dossier) ; CSP introuvable dans `csp.caddy` : échec.

## Variables GitHub à poser par Julien

Réglages du dépôt > Secrets and variables > Actions > onglet **Variables** :

- `SITE_CONTACT_EMAIL` : adresse du bouton « Lancer l'entretien ».
- `SITE_BASE_URL` : `https://<domaine>`, sans chemin ni barre finale.

## Premier déploiement, pas à pas

1. Poser les deux variables. 2. Fusionner la release (`release/<X.Y.Z>` vers `main`) : étiquette, release, job « Site statique
   de la release » ; vérifier `site-<X.Y.Z>.tar.gz` et `.sha256` sur la release (sinon `gh run rerun <id> --failed` après
   correction). 3. Sur le VPS : arrêter l'ancienne pile complète (`down` sans `-v`), pour libérer le socket. 4. Sous
   `app-site-perso` : `git pull --ff-only origin main`, exporter `DEPLOY_DIR=/srv/apps/site-perso`,
   `DEPLOY_COMPOSE=docker-compose`, `STATIC_RELEASE_REPO=<propriétaire>/<dépôt>`. 5. `bash scripts/deploy/deploy-static.sh
   <X.Y.Z>`. 6. Vérifier `/` (200, CSP, HSTS), `/fr` (301), `/en`, une route inconnue (404 du site), `/api/v1/health` (410).
   Détail et retour arrière : `docs/deploiement.md`.

## Vérifications

- `pnpm format:check` : vert. `pnpm integrity develop` : OK (aucun test existant touché).
- Tests nouveaux : `deploy-static` (21) et `prod-static` (10) verts ; `prod-vps`, `prod-compose` et les autres tests de
  déploiement qui ne dépendent pas de la commande `docker` verts.
- Pre-commit (lint, typecheck, test) passé à chaque commit.

## Non fait, points ouverts

- **Pile d'essai statique réelle (Caddy + archive + mode travaux) : NON prouvée.** `podman compose up -d` de
  `compose.vps-static.yml` n'a pas rendu la main en plus de 17 minutes (aucun conteneur créé, processus
  `docker-compose` en attente d'une réponse du service Podman) ; conformément à la consigne, la commande n'a pas été
  interrompue. Le script d'essai (`/tmp/claude-1000/-home-jlachaux-Projets-personnalWebsite-V3--claude-worktrees-main-branch-protection-check-38996e/3f720f75-02b2-4e4d-8482-a811f1d3e188/scratchpad/static-trial.sh`,
  processus 1511893 puis 1512030) est resté bloqué : à terminer et nettoyer par l'orchestrateur (projet compose
  `siteperso-v3-lot33-static`, dossier `/tmp/claude-1000/static-trial.*`, puis `down -v`). Le conteneur PostgreSQL de test du
  lot (`siteperso-v3-lot33-postgres-test-1`) tourne encore (base `siteperso_site` créée pour l'essai). À rejouer ensuite :
  le script vérifie `/`, `/en`, `/fr`, `/api/*`, les en-têtes, le mode travaux, le retour arrière puis `down -v`.
- `lint:shell` et `lint:workflows` (conteneurs) non lancés, Podman étant bloqué. À jouer : `pnpm lint:shell`,
  `pnpm lint:workflows`.
- 4 tests existants (`deploy-scripts.e2e-spec.ts` : `backup.sh` BACKUP_KEEP valides, `update.sh`) échouent sur ce poste : la
  commande `docker` y est absente (`docker est introuvable (DEPLOY_COMPOSE)`), sans lien avec ce lot (verts en CI, où docker
  existe).
- Pile d'essai statique non branchée dans la CI (pas de test `vps-static` comme pour `vps-stack`) : à ajouter avec une
  modification de `ci.yml` si Julien le souhaite.
- À relever sur le serveur réel : `curl`, `tar`, `sha256sum` du compte de l'appli, `podman inspect` et `exec`
  (`oom_score_adj`), droits de `/srv/site-perso-errors`, aucun conteneur de l'ancienne pile ne tient le socket.
- La release d'une version existante (avant ce lot) n'a pas d'archive : le premier déploiement statique exige une
  nouvelle release passée par ce workflow.
