# Tableau Trello : usage et flux de travail

Le suivi du chantier se fait sur le tableau Trello « Personal Website V3 » (espace de travail de
Julien). Ce document dit comment le tenir : il s'applique à la session principale (orchestrateur),
aux sessions de lot, aux agents et à OpenCode. Le détail technique reste dans le dépôt (`docs/lots.md`,
`docs/backlog.md`, comptes rendus) : une carte résume et renvoie, elle ne remplace pas la doc.

Décisions de Julien du 25 et du 26 nov. 2026.

## Listes

| Liste | Contenu | Entrée | Sortie |
|---|---|---|---|
| Backlog | Travail à faire, pas encore lancé. | Toute nouvelle tâche (bug, suite de revue, idée validée). | Vers « En cours » au lancement du lot. |
| À faire (Julien) | Actions réservées à Julien : décision à prendre, accord, fichier ou valeur à fournir, réglage GitHub, geste sur le serveur. | Quand une tâche attend Julien. | Archivée ou déplacée une fois faite. |
| En cours | Lots lancés (worktree et session ouverts). | Au lancement, aussitôt. | Vers « Fusionné dans develop » à la fusion de la PR. |
| Release et déploiement | Préparation de la release, accord de fusion vers `main`, déploiement. | Tâches de release. | Vers « Released ». |
| Fusionné dans develop (attend la release) | Lots fusionnés dans `develop`, pas encore sur `main`. | À la fusion de la PR vers `develop`. | Vers « Released » à la fusion de la release dans `main`. |
| Released | Livré sur `main` (étiquette `vX.Y.Z`). | À la release. | — |

Une carte qui n'est plus d'actualité (faite ailleurs, découpée, abandonnée) est **archivée**, jamais
supprimée : elle reste retrouvable.

## Étiquettes

- **Domaine** : `Front`, `Back`, `DevOps`. Elles indiquent le ou les agents pressentis
  (`.claude/agents/`) : `dev-front`, `qa-front`, `revue-a11y` pour le front ; `dev-api`,
  `dev-contrats`, `dev-sql` pour le back ; `dev-devops` pour la CI, les conteneurs, Caddy et le
  déploiement ; `lead-architecte` pour un fichier partagé ou une configuration protégée.
- **Exécutant** : `Claude` ou `OpenCode` (voir « Répartition » plus bas). Toute carte du Backlog en
  porte une, dès sa création.
- **`Julien`** : la carte attend une action de Julien. Une automatisation du tableau l'ajoute alors
  comme membre : il suffit de poser l'étiquette.
- **`Décision`** : une décision de Julien est attendue (avec `Julien`).
- **`Release`** : tâche du flux de release.

## Titre et contenu d'une carte

- Titre préfixé par le domaine ou le destinataire : `[Front]`, `[Back]`, `[DevOps]`, `[Julien]`,
  `[Bug]`, puis une phrase courte. Un lot lancé garde son numéro dans la description, pas dans le
  titre (les numéros se décident au lancement, voir plus bas).
- Description : **constat** (fichier et ligne, comportement observé), **attendu** ou **à faire**,
  **critères** de fin (tests, doc, CI verte). Une décision de Julien est datée.
- Chemins et identifiants entre accents graves. Aucune donnée personnelle (adresse, téléphone) :
  mêmes règles que le dépôt (`CLAUDE.md`).
- Une carte issue d'une autre (découpage, suite de revue) cite sa carte d'origine.

## Répartition entre Claude et OpenCode

- **OpenCode** : uniquement des tâches **atomiques**, courtes et bien bornées (un ou deux fichiers,
  critère vérifiable). Une carte à plusieurs points se découpe en une carte par point avant de lui être
  confiée ; la carte d'origine est archivée.
- **Claude** : conception et travail transverse, fichiers partagés, garde-fous (`.claude/hooks/`),
  modification d'un test existant ou d'une configuration protégée (OpenCode ne passe pas par les hooks
  de Claude Code, donc pas par les autorisations nominatives ni par `Justification-test`), sécurité et
  secrets, orchestration d'agents (revues, triage, recette).
- **Toujours Claude, session principale** : toute la gestion GitHub (push, pull request, suivi de la
  CI, lecture de la revue `revue-pr`, fusion) et le suivi du tableau.

## Cycle d'un lot

1. **Lancement** (session principale) : numéro de lot = le suivant libre (vérifier les branches
   `lot/*` existantes) ; worktree et branche `lot/N-nom` depuis `develop` à jour ; `.env` d'isolation
   (section « Worktrees en parallèle » de `CLAUDE.md`). La carte passe **aussitôt** dans « En cours »
   avec, dans sa description ou un commentaire : branche, worktree, projet compose et ports.
2. **Travail** (session de lot ou OpenCode) : commits sur la branche, vérifications ciblées (D26),
   compte rendu. Une question pour Julien passe par lui avant d'implémenter.
3. **PR** (session principale) : push, `gh pr create --base develop --head lot/N-nom`, suivi de la CI
   et de la revue. Le numéro de PR est noté sur la carte.
4. **Fusion** (session principale, CI verte, `VERDICT: OK`, accord de Julien) : `gh pr merge --merge`,
   puis la carte passe dans « Fusionné dans develop » avec le commit de merge.
5. **Release** : à la fusion de la release dans `main`, les cartes passent dans « Released ».

## Relecture du tableau

Quand Julien demande de « repasser sur le Trello », la session principale vérifie chaque carte
contre le dépôt et GitHub (branches, PR, commits, fichiers, rulesets) plutôt que de se fier à la
carte, corrige les descriptions périmées, déplace les cartes mal rangées, et signale ce qu'elle ne peut
pas trancher. Aucune carte n'est modifiée ni archivée sur la seule foi de son texte.

## Outils

- Connecteur Trello (MCP) : lecture, création, modification, déplacement, archivage, commentaires,
  pose et retrait d'étiquettes.
- Il ne sait ni créer une étiquette ni ajouter un membre : la création d'une étiquette passe par le
  navigateur (menu du tableau, « Étiquettes ») ; l'ajout de Julien passe par l'étiquette `Julien`.
