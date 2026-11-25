# Politique de sécurité

## Signaler une vulnérabilité

Ne pas ouvrir d'issue ni de pull request publique pour une faille de sécurité.

Utiliser le signalement privé de GitHub : onglet **Security** du dépôt, bouton **Report a vulnerability**
(https://github.com/julien-Lachaux/personnalWebsite_V3/security/advisories/new). Le rapport n'est visible que du
mainteneur. Indiquer si possible la version ou le commit concerné, les étapes de reproduction et l'impact
constaté.

Seule la branche `main` (version déployée) est prise en charge ; `develop` et les branches de travail ne le sont
pas.

_English: please report vulnerabilities privately through GitHub's "Report a vulnerability" button in the
Security tab, never in a public issue or pull request._

## Pull requests externes

Les contributions externes sont permises, mais une pull request d'un contributeur externe n'est jamais fusionnée
sans la relecture du mainteneur : ses workflows ne tournent qu'après son approbation, la fusion exige une CI verte,
et seul le mainteneur peut fusionner.

Règle de relecture du mainteneur (revue de sécurité RSP-1) :

- Lire le diff sur GitHub avant tout : une pull request externe ne se récupère jamais en local (checkout, ouverture
  de Claude Code, `pnpm install`, commit) si elle touche l'un de ces chemins, dont le code s'exécute
  automatiquement sur le poste ou au déploiement :
  - `.claude/` (hooks de Claude Code, lancés à l'ouverture d'une session et à chaque outil) ;
  - `.husky/` (hook pre-commit) ;
  - `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (scripts et dépendances installés) ;
  - `scripts/`, `docker/`, `.github/` (déploiement, conteneurs, CI) ;
  - `db/` (migrations et seeds exécutés au déploiement avec le rôle propriétaire de la base).
- Relire tout SQL de `db/` ligne à ligne.
- N'approuver l'exécution des workflows qu'après cette lecture.
