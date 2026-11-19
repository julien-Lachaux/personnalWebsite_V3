# Revue de sécurité de pré-publication (dépôt public), 19 novembre 2026

**Verdict : publiable tel quel.** Ni l'arbre ni l'historique ne contiennent de secret, de donnée personnelle
non voulue ni de détail d'infrastructure exploitable ; aucune réécriture d'historique n'est nécessaire. Les
findings ci-dessous sont des actions à mener **après** le push (réglages GitHub, vérification sur le VPS,
durcissements préventifs) ou des points acceptés avec leur justification.

## En-tête

- **Question** : une fois le dépôt et tout son historique publics, quelque chose permet-il de pirater
  Julien ou le futur serveur, ou facilite-t-il une attaque ?
- **Périmètre** : branche `v3/backend`, HEAD `c0ab105` au début de la revue, puis `4d65cac` (commit
  `docs:` du lot 13 arrivé pendant la revue, relu à part : deux fichiers de `docs/`, rien de sensible).
  Toutes les références locales : 24 branches, aucune étiquette, aucune note, aucun stash ; 210 commits
  atteignables. Hors périmètre : les décisions déjà prises (adresse de contact publique dans les métadonnées
  des commits, RS-10 ; contenu public du CV : prénom, nom, ville, LinkedIn, expériences).
- **Méthode** : lecture seule. Extraction de l'historique complet (`git log --all -p`, 53 286 lignes) dans
  le dossier temporaire de session, puis recherches par motifs (jetons, clés, chaînes de connexion,
  affectations de mots de passe, chaînes à forte entropie, téléphones, e-mails, IP, domaines, hébergeurs,
  chemins locaux) ; relecture de `git ls-files` (385 fichiers) ; inventaire des fichiers ajoutés puis
  supprimés ; inventaire des blobs volumineux et des extensions sensibles ; lecture de `docker/`,
  `scripts/deploy/`, `.github/`, `.claude/`, `CLAUDE.md`, `docs/` ; vérification des SHA d'actions contre
  les dépôts amont ; `pnpm audit` ; tests e2e de sécurité contre un PostgreSQL de test isolé.
- **Commandes principales** (sorties résumées dans chaque finding et dans « Fait ») :
  - `git for-each-ref` ; `git rev-list --count v3/backend..<branche>` pour chaque branche ;
  - `git log --all -p --no-color` puis `grep -E` (motifs ci-dessus) ;
  - `git log --all --diff-filter=D --name-only` ; `git log --all --format='%an <%ae> | %cn <%ce>'` ;
  - `git rev-list --objects --all | git cat-file --batch-check` (taille et nom des blobs) ;
  - `git check-ignore -v` sur les fichiers d'état et d'environnement ; `git status --ignored` ;
  - `git ls-remote --tags https://github.com/<action>.git` pour les quatre actions épinglées ;
  - `pnpm audit --prod` ; `pnpm audit --json` ;
  - `COMPOSE_PROJECT_NAME=siteperso-v3-revue-prepub POSTGRES_TEST_PORT=5643 pnpm db:test:up`, puis
    `vitest run --project e2e security security-headers errors rate-limit api-role prod-compose timeouts`.
- **Nettoyage** : conteneur et volume du projet compose `siteperso-v3-revue-prepub` supprimés
  (`docker compose down -v`) ; extraits d'historique effacés du dossier temporaire de session ; aucune pile
  de production ni image lancée ; aucun fichier du dépôt modifié hors ce rapport.

## Tableau

| Id    | Gravité | Classement                         | Résumé |
| ----- | ------- | ---------------------------------- | ------ |
| RSP-1 | moyen   | à corriger après le push           | Un dépôt public reçoit des PR : du code de contributeur peut s'exécuter sur le poste (hooks Claude Code, husky, scripts pnpm) ou, une fois fusionné, sur le VPS (`update.sh` + SQL exécuté en superutilisateur). Protection de branche et discipline de relecture à poser. |
| RSP-2 | mineur  | à corriger après le push (VPS)     | Faiblesse RS-4 (quota partagé par les visiteurs IPv6 si `docker-proxy` relaie) documentée publiquement et non encore vérifiée sur le serveur. |
| RSP-3 | mineur  | à corriger après le push           | `.gitignore` ne couvre ni clés, ni certificats, ni dumps ; la doc fait écrire `caddy-root.crt` à la racine du dépôt. |
| RSP-4 | info    | acceptable sous condition          | `docs/00` décrit la V2 (pile en fin de vie, nombre d'avis connus, routes) : sans effet si aucune instance V2 n'est en ligne. |
| RSP-5 | info    | acceptable                         | 5 avis « moderate » dans des dépendances de développement (chaîne Stryker) ; dépendances de production saines. |
| RSP-6 | info    | acceptable                         | Images PostgreSQL de dev et de la CI non épinglées par digest ; pnpm installé par npm dans l'étape de build. |
| RSP-7 | info    | acceptable (conseil de push)       | 24 branches locales, toutes ancêtres de `v3/backend` ; un `git push --all` publierait des noms de branches de travail sans contenu supplémentaire. |
| RSP-8 | info    | acceptable                         | Empreinte du poste de travail dans les comptes rendus (modèle de processeur, WSL2, noyau) ; aucune valeur pour attaquer le serveur. |

Aucun finding « bloquant avant push ». **Aucun secret ni aucune donnée personnelle à purger de l'historique.**

---

## RSP-1 : exécution de code de contributeur sur le poste et sur le VPS (moyen, à corriger après le push)

- **Fichiers** : `.claude/settings.json` (hooks `SessionStart`, `SubagentStart`, `PreToolUse`, `Stop`),
  `.claude/hooks/run.sh`, `.husky/pre-commit`, `package.json` (`"prepare": "husky"`),
  `pnpm-workspace.yaml` (`onlyBuiltDependencies`), `scripts/deploy/update.sh:155-161`,
  `docker/compose.prod.yml:87-99`.
- **Condition** : le dépôt devient public ; n'importe qui peut ouvrir une PR depuis un fork. Deux chemins
  existent, propres à tout dépôt public mais plus marqués ici :
  1. **Poste de Julien** : récupérer localement la branche d'une PR (pour la tester) puis ouvrir Claude Code,
     committer ou lancer `pnpm install` dans ce checkout exécute des commandes définies par des fichiers
     versionnés, donc modifiables par la PR. Les hooks Claude Code sont lancés automatiquement à chaque
     ouverture de session et à chaque appel d'outil, sans commande explicite de l'utilisateur.
  2. **Serveur** : `update.sh` déploie ce que contient la branche suivie (`git pull --ff-only`), puis le
     service `migrate` exécute les fichiers de `db/migrations` et `db/seeds` avec le rôle propriétaire
     `siteperso`, superutilisateur de l'image PostgreSQL. Un SQL malveillant fusionné par mégarde
     s'exécuterait avec tous les droits dans le conteneur PostgreSQL au déploiement suivant.
- **Constat** :
  ```
  $ grep -n 'run.sh' .claude/settings.json
  "command": "sh \"$CLAUDE_PROJECT_DIR/.claude/hooks/run.sh\" session-start",
  "command": "sh \"$CLAUDE_PROJECT_DIR/.claude/hooks/run.sh\" subagent-start",
  "command": "sh \"$CLAUDE_PROJECT_DIR/.claude/hooks/run.sh\" pre-tool-use",
  ...
  $ sed -n 13p .claude/hooks/run.sh
  exec node "$dir/guard.mjs" "$@"
  $ sed -n 155p scripts/deploy/update.sh ; sed -n 161p scripts/deploy/update.sh
  run git -C "${REPO_DIR}" pull --ff-only
  run compose run --rm migrate
  $ sed -n 158p docs/deploiement.md
  - `siteperso` (`POSTGRES_PASSWORD`) : superutilisateur de l'image PostgreSQL, propriétaire du schéma.
  $ ls .github/CODEOWNERS SECURITY.md .github/SECURITY.md
  ls: cannot access ... : No such file or directory   (trois fois)
  ```
  La CI, elle, est saine pour un dépôt public : déclencheurs `push` et `pull_request` (pas de
  `pull_request_target`), `permissions: contents: read`, aucun secret, aucune expression `github.event.*`
  interpolée dans un script, aucun exécuteur auto-hébergé ; le cache pnpm d'une PR de fork est cantonné à
  la référence de la PR.
- **Impact** : exécution de code sur le poste de Julien (accès à sa clé SSH, à ses sessions, aux `.env`
  locaux) ou, après fusion, sur le VPS au déploiement suivant. Rien n'est exploitable sans une action de
  Julien (checkout local ou fusion) : c'est un risque d'ingénierie sociale, pas une faille ouverte.
- **Facteurs atténuants** : Julien est seul à pouvoir écrire sur le dépôt ; aucune PR externe n'existe ; la
  CI des PR de fork tourne sur des exécuteurs GitHub éphémères, sans secret ni droit d'écriture ; l'image de
  l'API installe ses dépendances avec `--frozen-lockfile --ignore-scripts` ; l'API elle-même n'utilise que le
  rôle `siteperso_api` en lecture seule (vérifié par `api-role.e2e-spec.ts`, vert dans cette revue).
- **Proposition** (après création du dépôt public, rien à changer dans l'historique) :
  1. Protection de la branche suivie par le VPS (`main`) : pas de push forcé, pas de suppression, fusion par
     PR avec CI verte ; double authentification sur le compte GitHub.
  2. Réglages Actions : approbation requise pour les workflows de **tous** les contributeurs externes ;
     permissions par défaut du `GITHUB_TOKEN` en lecture ; « Allow GitHub Actions to create and approve pull
     requests » désactivé.
  3. Règle de relecture écrite (par exemple dans un `SECURITY.md` ou `CONTRIBUTING.md`) : ne jamais récupérer
     localement une PR externe qui touche `.claude/`, `.husky/`, `package.json`, `pnpm-workspace.yaml`,
     `pnpm-lock.yaml`, `scripts/`, `docker/` ou `db/` sans avoir lu son diff sur GitHub ; relire tout SQL
     ligne à ligne ; un `CODEOWNERS` sur ces chemins rend la relecture explicite.
  4. Activer secret scanning, push protection et le signalement privé de vulnérabilités ; ajouter un
     `SECURITY.md` qui indique ce canal.
  5. Durcissement possible plus tard : un rôle propriétaire non superutilisateur pour `migrate` (le
     superutilisateur de l'image ne servant qu'à créer ce rôle et la base).

## RSP-2 : faiblesse RS-4 publiée et non vérifiée sur le serveur (mineur, à corriger après le push)

- **Fichiers** : `docs/deploiement.md:110-129`, `docs/revues/securite-2026-11-18.md:123-147`,
  `docs/compte-rendu-2026-11-18.md:88`, `docker/compose.prod.yml:153-158` (réseaux sans `enable_ipv6`).
- **Condition** : si, sur le VPS, Docker relaie le trafic IPv6 par `docker-proxy`, Caddy voit l'adresse de
  la passerelle pour tous ces visiteurs, qui partagent alors un seul quota de 100 requêtes par minute.
- **Constat** :
  ```
  $ sed -n 88p docs/compte-rendu-2026-11-18.md
  | RS-4 : IP vue par Caddy pour les visiteurs IPv6 sur le VPS | Non relevée. Procédure dans `docs/deploiement.md` ; ...
  $ grep -n 'enable_ipv6' docker/compose.prod.yml
  (aucune sortie)
  ```
  Le dépôt public décrit la condition, la façon de la constater et le seuil du quota.
- **Impact** : un seul client IPv6 peut mettre en 429 tous les visiteurs IPv6 pendant une minute (déni de
  service partiel d'une API de contenu public). Aucune donnée exposée.
- **Facteurs atténuants** : la condition dépend de l'hôte (non observée sur le trafic IPv4 d'un VPS Linux) ;
  elle se découvre aussi sans lire le dépôt ; l'effet est borné à la fenêtre du quota.
- **Proposition** : **à vérifier après déploiement**, avec la procédure de `docs/deploiement.md:118-123`
  (requêtes en IPv6 puis lecture de `remote_ip` dans le journal de Caddy). Si l'adresse est privée :
  `"userland-proxy": false` dans le démon Docker, ou `enable_ipv6: true` avec un sous-réseau sur le réseau
  `edge`. Consigner le résultat dans `docs/deploiement.md`, idéalement avant l'ouverture du front.

## RSP-3 : `.gitignore` sans filet pour clés, certificats et dumps (mineur, à corriger après le push)

- **Fichiers** : `.gitignore`, `docs/deploiement.md:227-229`.
- **Condition** : un fichier sensible déposé dans l'arbre de travail serait proposé par `git add -A` et
  publié au push suivant. La documentation fait d'ailleurs copier le certificat racine de Caddy dans le
  dossier courant, c'est-à-dire la racine du dépôt.
- **Constat** :
  ```
  $ for f in caddy-root.crt backups/siteperso-x.sql.gz dump.sql.gz server.key id_ed25519 docker/.env.prod; do
      git check-ignore -q "$f" && echo "ignoré   $f" || echo "NON ignoré $f"; done
  NON ignoré caddy-root.crt
  NON ignoré backups/siteperso-x.sql.gz
  NON ignoré dump.sql.gz
  NON ignoré server.key
  NON ignoré id_ed25519
  ignoré   docker/.env.prod
  ```
  Aucun de ces fichiers n'existe dans l'arbre ni dans l'historique (inventaire des blobs : aucune extension
  `.gz`, `.dump`, `.pem`, `.key`, `.crt`, `.p12`, `.log`, `.sqlite`, aucun `id_rsa`, aucun `.env`).
- **Impact** : aujourd'hui nul ; demain, un dump de base (contenu public, mais aussi hachés des mots de passe
  des rôles) ou une clé privée commitée par erreur deviendrait public et impossible à retirer après push.
  Le certificat racine local, lui, n'est pas secret (seule sa clé l'est, et elle reste dans le volume Caddy).
- **Facteurs atténuants** : les sauvegardes de `backup.sh` vont dans `DEPLOY_DIR/backups`, hors du clone
  (`/opt/siteperso-v3` par défaut, le clone étant `DEPLOY_DIR/repo`) ; les `.env*` sont bien ignorés.
- **Proposition** : ajouter à `.gitignore` `*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`, `id_rsa*`,
  `id_ed25519*`, `*.sql.gz`, `*.dump`, `backups/` ; dans `docs/deploiement.md`, copier le certificat vers un
  chemin hors du dépôt (par exemple le dossier temporaire du système).

## RSP-4 : description de la V2 dans `docs/00-etat-des-lieux-v2.md` (info, acceptable sous condition)

- **Fichier** : `docs/00-etat-des-lieux-v2.md:3-5`, `:8-13`, `:43-44`.
- **Condition** : le document décrit la V2 (versions d'un framework en fin de vie, nombre d'avis de sécurité
  connus de ses dépendances, routes AJAX, page de repli sur toute URL, 500 sur un panneau inconnu). Cela ne
  sert un attaquant que si une instance V2 est joignable sur Internet.
- **Constat** : `sed -n 3,5p docs/00-etat-des-lieux-v2.md` montre les versions ; `sed -n 43,44p` le nombre
  d'avis. Aucune valeur (domaine, téléphone, e-mail de la V2) n'est recopiée : le document dit seulement
  qu'ils étaient affichés. Je n'ai pas pu déterminer si une V2 est en production (pas de domaine dans les
  dépôts, pas d'accès au serveur).
- **Impact** : nul si la V2 est hors ligne ; sinon, une cible déjà vulnérable devient plus facile à repérer.
- **Proposition** : confirmer qu'aucune V2 n'est en ligne (ou l'arrêter, ce qui est le seul correctif d'une
  pile en fin de vie) ; inutile de réécrire l'historique.

## RSP-5 : avis de sécurité dans les dépendances de développement (info, acceptable)

- **Constat** :
  ```
  $ pnpm audit --prod
  No known vulnerabilities found
  $ pnpm audit --json | (résumé)
  moderate qs        GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw
                     chemin : apps__api>@stryker-mutator/core>typed-rest-client>qs
  moderate minimatch GHSA-g3hv-75wg-m249   chemin : apps__api>@stryker-mutator/core>minimatch
  ```
  `pnpm --version` : 10.34.9 (au-dessus du plancher 10.34.5) ; le lockfile ne résout que sur le registre npm
  (528 empreintes `sha512`, aucune URL de tarball ni dépendance git) ; seuls `@swc/core` et `esbuild` ont
  droit à leurs scripts d'installation.
- **Justification** : outillage de test par mutation, absent de l'image de production (`pnpm deploy --prod`)
  et jamais exécuté sur le serveur ; dénis de service sur des entrées que l'outil ne reçoit pas d'un tiers.
  Dependabot (`npm`, hebdomadaire) proposera la montée de version.

## RSP-6 : images non épinglées hors production (info, acceptable)

- **Constat** : `docker-compose.yml:13`, `:30` et `.github/workflows/ci.yml:71`, `:181` :
  `image: postgres:16-alpine` sans digest ; `docker/api.Dockerfile:14` installe pnpm par
  `npm install --global pnpm@10.34.9` dans l'étape de build. En production, tout est épinglé :
  `node:26.13.1-alpine@sha256:…`, `caddy:2@sha256:…`, `postgres:16-alpine@sha256:…`.
- **Justification** : bases de dev et de CI jetables, sans secret ; l'étape `deps` n'est pas dans l'image
  finale et pnpm vient du registre officiel à une version exacte. Écart déjà consigné
  (`docs/compte-rendu-2026-11-18.md:115`).

## RSP-7 : périmètre du push (info, conseil)

- **Constat** :
  ```
  $ for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
      echo "$b: $(git rev-list --count v3/backend..$b)"; done
  (24 branches, toutes à 0 : lot/*, master, v3/backend, six worktree-wf_*)
  $ git for-each-ref refs/tags refs/notes ; git stash list
  (aucune sortie)
  ```
  Il n'existe pas encore de branche `main` locale (seulement `master`, ancêtre de `v3/backend`).
- **Justification** : un `git push --all` ne publierait aucun contenu absent de `v3/backend` ; il exposerait
  seulement des noms de branches de travail. Les objets inaccessibles locaux ne sont jamais poussés.
- **Proposition** : créer `main`, y fusionner `v3/backend`, puis pousser explicitement `main` (et
  `v3/backend` si utile) plutôt que `--all`.

## RSP-8 : empreinte du poste de travail dans les comptes rendus (info, acceptable)

- **Constat** : `docs/comptes-rendus/lot-11-mutation-mesure.md:61`, `docs/comptes-rendus/lot-12-mutation-phase2.md:174`,
  `docs/lots.md:187` citent le modèle de processeur, WSL2 et la version du noyau du poste ; les 210 commits
  portent le même fuseau horaire.
- **Justification** : aucune adresse, aucun nom de machine, aucun chemin personnel (`git log --all -p | grep -c`
  sur l'identifiant système local : 0) ; rien qui serve à joindre ou attaquer le poste ou le serveur.

---

## Fait

1. **Secrets et accès** : aucun jeton, clé, mot de passe réel ni chaîne de connexion réelle dans l'arbre ou
   l'historique. Toutes les chaînes `postgres://` relevées sont des identifiants de dev (`siteperso`, base
   locale ou de test), des valeurs de test (`u:p`, `user:secret`) ou des interpolations `${…:?…}`. Les
   modèles d'environnement ne portent que `change-me`, `__GENERE__`, `example.test`, `localhost`. Les seules
   chaînes à forte entropie sont les SHA des actions (vérifiés contre les étiquettes amont : checkout v4.4.0,
   setup-node v4.4.0, pnpm/action-setup v4.4.0 et v5.0.0, upload-artifact v7.0.2) et les empreintes du
   lockfile. Un seul fichier supprimé dans l'historique (`apps/api/vitest.e2e.config.ts`), sans secret. Aucun
   `.env` réel, aucun `audit.log`, aucun `state/`, aucun `settings.local.json` jamais commité ; tous sont
   ignorés (`git check-ignore -v`). `.npmrc` sans jeton.
2. **Données personnelles** : aucun téléphone (seul un numéro factice de test), aucune adresse postale,
   aucune date de naissance, aucun nom de proche, aucun identifiant système ou chemin personnel dans
   l'historique. E-mails présents : domaines réservés ou factices, l'adresse d'attribution des commits
   d'agents, et l'adresse de contact dans les métadonnées des commits (décision RS-10, hors finding). Le
   rapport du 18 novembre ne cite cette adresse que tronquée. Le contenu du CV (identité, ville, LinkedIn,
   expériences, pause professionnelle) est public par nature.
3. **Infrastructure** : aucun domaine réel, aucune IP réelle (seulement plages de documentation, adresses
   privées, boucle locale et deux résolveurs publics dans des tests), aucun hébergeur, aucun nom d'hôte, aucun
   utilisateur SSH, aucune règle de pare-feu. `DEPLOY_DIR=/opt/siteperso-v3` et `sauvegarde@hote-distant`
   sont des valeurs par défaut ou d'exemple. Versions d'images, topologie réseau et ports 80/443 relèvent du
   code publié, inévitables et sans avantage notable (la défense ne repose pas sur leur secret).
4. **Surface du code** (lecture et tests) : `vitest run --project e2e security security-headers errors
   rate-limit api-role prod-compose timeouts` → `Test Files 7 passed (7)`, `Tests 146 passed (146)`.
   Relus : `create-app.ts` (corps 1 Kio, `requestTimeout`, `handlerTimeout`, helmet et CSP, rate limit en
   `onRequest` racine, 405 avec `Allow`, CORS liste d'origines URL validées), `env.schema.ts` (`TRUST_PROXY`
   `true` refusé), `provision-api-role.ts` (nom validé, mot de passe quoté par `format('%L')`, `select` seul),
   `api.Dockerfile` (base par digest, `--ignore-scripts`, utilisateur `node`, code à root, npm/yarn/wget/nc
   retirés, `db:reset` retiré), `compose.prod.yml` (seul Caddy publie, `app` et `data` internes, lecture
   seule, `cap_drop: ALL`, `no-new-privileges`, limites), `Caddyfile` (sans `Server` ni `Via`, HSTS,
   plafond de corps). Défaut latent `detailOf` (`problem-details.ts:53`, `'message' in null`) : seul du code
   interne peut construire une telle exception, inatteignable par un client ; déjà planifié (L13-04).
5. **CI et build** : voir RSP-1 (CI saine pour un dépôt public), RSP-5 et RSP-6. `pnpm install
   --frozen-lockfile` partout ; `pnpm audit --prod --audit-level=high` en CI ; artefacts publics = rapports
   lcov et HTML de mutation, sans secret.
6. **Fichiers d'agents et garde-fous** : `.claude/agents/*.md`, `.claude/hooks/*`, `.claude/settings.json`,
   `CLAUDE.md`, `docs/03` ne contiennent ni accès, ni chemin absolu, ni identifiant. La description des
   limites des garde-fous aide seulement à contourner des contrôles de qualité des agents, pas à attaquer le
   poste ou le serveur. Le risque réel de ces fichiers une fois publics est leur exécution automatique sur une
   branche modifiée par un tiers (RSP-1).
7. **Fichiers à ne pas publier** : `git ls-files` relu en entier (385 fichiers) : sources, tests,
   configurations, docs, lockfile, snapshot OpenAPI voulu ; aucun artefact de build, rapport de couverture ou
   de mutation, dump ou fichier local. Plus gros blob de l'historique : `pnpm-lock.yaml` (environ 170 Kio).

## Non fait

- Visibilité et réglages réels du dépôt GitHub distant (CLI `gh` absente, pas d'accès authentifié) : à
  vérifier par Julien (RSP-1, points 1 à 4).
- Comportement du serveur réel (IP vue par Caddy en IPv6, en-têtes servis, TLS) : **à vérifier après
  déploiement** (RSP-2, procédure dans `docs/deploiement.md`).
- Existence d'une V2 en ligne (RSP-4).
- Image de production non reconstruite ni lancée (consigne) : ses propriétés sont constatées par lecture du
  Dockerfile et par le job CI `docker` ; la configuration compose résolue est vérifiée par
  `prod-compose.e2e-spec.ts` (vert).
- Comportement de Claude Code face à un `.claude/settings.json` modifié dans un dossier déjà approuvé (une
  nouvelle confirmation est-elle demandée ?) : non testé ; la proposition de RSP-1 ne dépend pas de la réponse.

## Décisions

- Aucune réécriture d'historique recommandée : rien n'y justifie une purge.
- Classement « après le push » pour RSP-1 à RSP-3 : leurs corrections ne touchent pas l'historique et, pour
  RSP-1, n'existent que côté GitHub une fois le dépôt créé.

## Points ouverts

- RSP-1 : poser protection de branche, réglages Actions, secret scanning et `SECURITY.md` dès la création du
  dépôt public ; choisir entre `CODEOWNERS` et une règle de relecture écrite.
- RSP-2 : relever l'IP vue par Caddy en IPv6 au premier déploiement et consigner le résultat.
- RSP-3 : compléter `.gitignore` et déplacer la copie du certificat local hors du dépôt (petit commit `chore:`).
- RSP-4 : confirmer qu'aucune instance V2 n'est en ligne.
