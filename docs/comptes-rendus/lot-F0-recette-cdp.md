# Lot F0 : recette du chef de projet

Date : 20 novembre 2026. Branche `lot/F0-fondations` (4598440), base `develop` (point de divergence
09b7f0c). Isolation : `.env` racine du lot (`siteperso-v3-f0`, 5842/5843, Playwright 5844/5845),
`docker compose down -v` avant la passe, `pnpm db:down` à la fin, clone jetable supprimé.

## Verdict : accepté avec réserves

Tous les critères de F0 sont rejoués et verts. Les réserves (R1 à R4) ne bloquent pas la fusion ;
elles sont à connaître avant F2.

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| Aucune modif back | `git diff --stat develop...lot/F0-fondations -- apps/api db packages/contracts` | vide |
| dev sert `/` en fr et `/en` en en (F0-01, F0-05) | `pnpm dev --port 3011` (apps/web) puis `curl` | `/` : 200, `<html lang="fr">`, `<h1>Site en construction`, hreflang x-default, fr, en ; `/en` : 200, `lang="en"`, `<h1>Website under construction` ; `/xx`, `/en/xx`, `/fr` : 404 (FR sans préfixe, conforme à `prefix_except_default`) |
| `generate` produit les deux pages | `pnpm generate` | `.output/public/index.html` (`lang="fr"`, h1 FR) et `.output/public/en/index.html` (`lang="en"`, h1 EN) |
| `pnpm check` vert sur conteneurs neufs | `docker compose down -v` puis `pnpm check` | code 0 ; 12 tâches réussies ; intégrité OK ; unitaires API 391, contrats 133, front 14 ; e2e API 552, Playwright 35 ; couverture 100 % sur les quatre métriques : API 711/711 instructions, 236/236 branches, 246/246 fonctions, 692/692 lignes ; contrats 51/51 ; front 12/12, 2/2, 4/4, 9/9 |
| Couverture 100 % sur `apps/web/app` | inclus dans `pnpm check` (`include: app/**/*.{ts,vue}`, seul `*.spec.ts` exclu) | 100 % |
| `pnpm hooks:test` | idem | 549/549, 0 échec |
| `pnpm integrity develop` | idem | « Intégrité des tests : OK », code 0 |
| `pnpm integrity:test` | idem | 19 + 3 + 8 + 8 réussis, 0 échec |
| Stryker front avec seuil | `pnpm test:mutation` (clone) | code 0, `thresholds.break: 100`, « score NaN ≥ seuil 100 » (aucun fichier à muter, voir R1) |
| Test d'architecture du domaine | `app/architecture.spec.ts` (6 cas, dans les 14 unitaires) | vert ; prouve son détecteur sur des sources et un arbre temporaire |
| Playwright + axe, 7 tailles, 2 schémas | `playwright.config.ts` : 390, 834, 1024, 1280, 1440, 1920, 3440 ; `smoke.e2e.ts` : `light`/`dark`, étiquettes wcag2a à wcag22aa | 35 tests verts dans `pnpm check` (28 fumées + 7 témoins) |
| Agents | `.claude/agents/` | `dev-front`, `qa-front`, `revue-a11y` créés (même frontmatter et mêmes sections que `dev-api`/`revue-code` : appel, fichiers, méthode, livrable, intégrité, sortie honorable, terminé quand ; modèles sonnet/sonnet/opus) ; `lead-architecte`, `dev-devops`, `revue-code`, `revue-securite` étendus (sections « Front » ou « Grille front » ajoutées) |
| CLAUDE.md section front | `grep` | section « Front (`apps/web`, docs/05) » (l. 99) : structure, couches, modules isolés, libellés par section, WCAG 2.2 AA, commandes |
| E-mail et téléphone | recherche de motifs sur les fichiers du lot et sur `apps/web/design/handoff-v6` | aucune adresse hors `contact@example.org` et `ci@noreply.invalid` (tests des garde-fous) ; aucun téléphone (deux faux positifs de motif dans du JavaScript des maquettes) |

## Recette du processus

- **Diff des tests** : aucun test existant modifié ni supprimé (`git diff --name-status` : uniquement
  des ajouts pour tous les `*.spec.ts`, `*.e2e.ts`, `front-oracles.test.mjs`, `front-integrity.test.sh`).
  Fichiers de configuration modifiés ou créés : `policy.mjs`, `check-tests-integrity.sh`, `ci.yml`,
  `turbo.json`, README des hooks, configurations Vitest, Playwright et Stryker du front. Chacun des
  commits concernés porte une ligne `Justification-test` (vérifiée commit par commit) qui cite
  l'autorisation 7302c938 ou faef9b2d. Les nouveaux garde-fous sont des durcissements (marqueurs
  `fixme`, `slow`, `fail` de Playwright ; captures de référence protégées), aucune assertion
  existante n'est affaiblie ; ses tests passent (549 hooks, 36 intégrité).
- **Journal `.claude/hooks/audit.log`** (lead, 19-20 nov.) : 39 usages de 7302c938 et 5 de faef9b2d,
  tous sur des chemins listés par l'autorisation (policy.mjs, stryker et vitest du front, turbo.json,
  ci.yml, check-tests-integrity.sh, six fichiers d'agents, README des hooks, deux fichiers de tests
  des garde-fous). Aucun usage hors liste, aucun usage après expiration de faef9b2d. Refus du lead :
  écritures opaques (python3, node, bash) mentionnant un oracle, scripts de garde-fous lancés par un
  agent, cible illisible, et un refus « fails » sur le compte rendu du lead (mot du texte, résolu).
  Aucune tentative répétée du même contournement ; chaque refus a été suivi d'un passage par
  l'outil prévu. Aucune violation de fin de tâche relevée.
- **Cycles édition-test** : aucun fichier au-dessus de 3 commits (`apps/web/package.json`). Le journal
  montre sept éditions de `apps/web/stryker.config.mjs` en quatre minutes (22:23 à 22:27, 19 nov.),
  pendant la mise au point (vérificateur TypeScript retiré, `related: false`, `.nuxt` réintégré) :
  les décisions sont motivées dans le compte rendu du lead et la configuration finale ne baisse
  aucun seuil. Transcription non fournie : alternances non comptées.
- **Marqueurs et ignores** : aucun `skip`, `only`, `todo`, `fixme`, `slow`, `fails`, ni commentaire
  d'ignore ou directive `Stryker disable` dans `apps/web` (seule occurrence : un commentaire
  expliquant `.only` dans `playwright.config.ts`).
- **Retrait de tests au hasard** (clone jetable, `shuf`) : tirage 1,
  `i18n-messages.spec.ts` « mêmes clés en français et en anglais » ; tirage 2 (supplémentaire),
  `app.spec.ts` « page anglaise sous /en ». Dans les deux cas `pnpm test:coverage` reste vert
  (code 0, 100 %). Voir R2.
- **Tests de réserve** : le lot ne touche pas l'API, les tests de réserve contre le contrat OpenAPI
  ne s'appliquent pas (aucune route ni schéma modifié). Cinq scénarios sur le front servi en dev :
  `/`, `/en`, `/xx`, `/en/xx`, `/fr` ; un échec de principe : `/fr` répond 404 (voir R3).

## Réserves

- **R1 : Stryker du front est vide.** Le score vaut NaN, le seuil de 100 passe par défaut tant que
  `app/domain` et `app/data` n'existent pas ; la sonde du lead (fonction `clamp` temporaire) montre
  que le seuil mord. À revérifier au premier fichier de F2 : `pnpm test:mutation` doit alors afficher
  un score chiffré.
- **R2 : la couverture n'impose pas les tests de composant.** Retirer le test de la page anglaise ou
  la parité fr/en des libellés laisse `pnpm test:coverage` vert : `app.vue` n'a pas de branche
  par langue, et un test de contenu JSON ne couvre aucun code de production. La parité est donc
  portée par l'assertion seule (et, pour la page anglaise, par les parcours Playwright). Pas un
  défaut du lot, mais l'oracle de ces tests est la revue et non la couverture ; Stryker ne couvrira
  les composants qu'à partir d'un éventuel élargissement (question 1).
- **R3 : `/fr` donne 404** (FR sans préfixe, EN sous `/en`) : conforme à la décision
  `prefix_except_default`, mais un lien externe vers `/fr` échouerait. À confirmer comme voulu.
- **R4 : points ouverts du lead, repris** : carte d'import Nuxt dans la CSP (F9), pairs `@babel` 8
  non respectés (interne à Nuxt), image Playwright lancée par `npx -y playwright@1.65.1` hors
  lockfile, noms de fichiers non ASCII dans `check-tests-integrity.sh`, faux positif de `FAILS_RE`
  sur `includes`. TypeScript 6.0.3 conservé faute de support de typescript-eslint pour 7.x.

## Questions fermées pour Julien

1. Étend-on Stryker aux composants (`app/components`, `app/pages`) dès F3, plutôt que de le limiter
   à `domain` et `data` ? Oui / non.
2. L'URL `/fr` doit-elle rediriger vers `/` ? Oui / non.
3. Corrige-t-on `check-tests-integrity.sh` (`core.quotePath=false`, motif `includes`) dans un lot
   dédié avant F1 ? Oui / non.

## Fait, non fait

Fait : tous les critères F0-01 à F0-08 rejoués et prouvés. Non fait : transcription de l'agent
(non fournie), tests de réserve OpenAPI (hors périmètre, API intacte), `pnpm check` rejoué une seule
fois par moi (le lead en rapporte deux).
