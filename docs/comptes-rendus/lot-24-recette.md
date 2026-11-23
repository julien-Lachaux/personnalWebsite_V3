# Recette du lot 24 (brief back-005, BF-13 à BF-15)

Date : 23 nov. 2026. Branche `lot/24-service-front`, tête c608a76, PR #13 vers `develop`.
Recette ciblée (règle D26) : ni `pnpm check`, ni mutation complète, ni pile locale (la CI les a jouées).

## Preuves rejouées

| Contrôle | Commande | Résultat |
|---|---|---|
| CI sur la tête | `gh run view 45156228332 --json jobs,headSha,conclusion` | headSha c608a76, `success`, 18 jobs verts dont « Pile locale complète (Caddy, API, front, PostgreSQL) », « Tests e2e et couverture 100 % », « Garde-fous », mutations API/contrats/front, parcours Playwright des 7 tailles, « Revue PR » |
| Runs précédents | `gh run list --branch lot/24-service-front` | deaab6c et 3bdb770 également `success` |
| Intégrité | `pnpm integrity develop` | code 0, « Intégrité des tests : OK » |
| Marqueurs de contournement | grep des lignes ajoutées (`skip`, `only`, `todo`, `fails`, `skipIf`, `runIf`, `fixme`, ignore v8/c8/istanbul) sur `git diff develop...HEAD` | aucune occurrence |
| Tests existants touchés | `git diff --diff-filter=MD develop...HEAD` | seul `.github/workflows/ci.yml` (M) ; aucun test présent dans `develop` n'est modifié ni supprimé |

## Critères par ticket

- **BF-13 (construire le front)** : `docker/web.Dockerfile` + `scripts/deploy/web-generate.sh` (génération dans un volume, lien `current` basculé atomiquement, après API saine) ; vérifié par `web-front-config.e2e-spec.ts` et `web-generate.e2e-spec.ts`, verts en CI. Un échec de génération laisse la version précédente (lien non basculé). Acceptée.
- **BF-14 (Caddy, 301 de /fr, CSP, cache)** : `docker/Caddyfile` relu. 301 de `/fr` et `/fr/*` par liste blanche (corrige la redirection ouverte `/fr/%09/hote`, deaab6c), `try_files`, 404 du front servie avec statut 404 (fr et `/en/404.html`), cache `immutable` sur `/_nuxt/`, `no-cache` sur le reste, CSP importée depuis `csp.caddy` calculée par `scripts/deploy/csp-hashes.mjs` (`csp-hashes.e2e-spec.ts`). Garde de `/fr` vérifiée par `fr-redirect.e2e-spec.ts` (expressions du Caddyfile) et `local-stack-fr-redirect.e2e-spec.ts` (vraies requêtes HTTP, job `pile-locale`) : verts. Acceptée.
- **BF-15 (pile locale et parcours de fumée)** : `scripts/deploy/csp-smoke.mjs`, `local-stack-front.e2e-spec.ts` (`/`, `/en`, `/fr` 301, route inconnue 404, PDF `application/pdf`, CSP, aucune violation en console) ; job CI `pile-locale` vert sur la tête. Acceptée.

## Tests ajustés avec Justification-test

Les deux fichiers sont créés dans ce lot (absents de `develop`) : ce ne sont pas des tests existants au sens de `pnpm integrity`, mais chaque changement porte sa ligne.

- 9786b88 `web-front-config.e2e-spec.ts` : retire l'attente `read_only` de `web-build` (décision de Julien du 22 nov., EROFS constaté ; Nuxt vide `.output`). Seules l'assertion `read_only` et le titre changent ; capacités, no-new-privileges et ressources restent vérifiées. Pas d'affaiblissement ailleurs.
- 3bdb770 `local-stack-front.e2e-spec.ts` : `/en/accessibilite` devient `/en/accessibility` (route réelle de F7, BF-15). Vérification inchangée.
- `ci.yml` (Justification-test BF-15) : étapes ajoutées (navigateurs, arrêt), timeout du job `pile-locale` de 20 à 35 min ; aucun contrôle retiré.

## Journal des garde-fous (période 22-23 nov.)

Pour dev-devops et correcteur : 33 autorisations utilisées, 8 refus, tous des écritures opaques (python3, node) mentionnant un oracle, une cible illisible ou l'édition de `web-front-config.e2e-spec.ts` sans autorisation « tests ». Pas de répétition d'une même commande contournée. Les événements `violation` relevés sont du rôle `main` (lot F9a, `csp.e2e.ts`), hors de ce lot. Aucune violation de fin de tâche pour dev-devops.

## Cycles édition-test

Fichiers les plus retouchés depuis `develop` : `lot-24-devops.md` 6, `Caddyfile` 4, `csp-smoke.mjs` 3, les autres 2 au plus. Aucun fichier au-dessus de cinq cycles.

## Non fait (volontairement)

- Retrait d'un test au hasard puis `pnpm test:coverage` (étape 5) et scénarios de réserve contre l'API démarrée (étape 6) : exigent une base, une API et la pile ; la consigne de l'orchestrateur interdit de les lancer. À rejouer en recette finale. Le job `mutation` de la CI (API, contrats, front) est vert sur la tête.
- Le backlog ne détaille pas de tickets pour le lot 24 (section d'une ligne renvoyant au brief) : les critères sont ceux du brief, BF-13 à BF-15.
- Transcription de l'agent non fournie : cycles lus par l'historique git seulement.
- Un refus rencontré par moi : une commande `node -e` lisant `audit.log` a été refusée (« écriture opaque (node) qui mentionne un oracle »). Non contournée par la même forme ; le journal a ensuite été lu par `grep` simple.

## Points ouverts

- Chemin `/fr/..` : accepté par la liste blanche (`.` en premier caractère), redirige vers `/..` que le navigateur normalise en `/` ; sans effet de sécurité relevé.

## Verdict

**Acceptée.**
