# Lot 22, partie CI : compte rendu dev-devops (21 nov. 2026)

## Fait

Commits : `a1a5348` (workflows), `f317c16` (docs/deploiement.md), plus ce compte rendu.

- **L22-01 / L22-02, déclencheurs** : `ci.yml` tourne sur `pull_request` (vers `develop` et `main`, types opened,
  synchronize, reopened, ready_for_review), `push` sur `main` seulement, `workflow_dispatch`. Plus de push sur
  `develop`, `lot/**`, `release/**`, `hotfix/**`, ni d'étiquette. `ready_for_review` ajouté : la revue échoue sur un
  brouillon (garde) et doit repartir à sa sortie (coût : la CI complète repart à ce moment).
- **L22-03, arrêt au premier échec** : étape finale `Annuler le run (premier échec)` (`if: failure()`, `gh run cancel`
  avec `GH_TOKEN`, `GH_REPO`, `RUN_ID` passés par `env`) dans les huit jobs requis ; `actions: write` seulement sur
  ces jobs (commenté), `contents: read` au niveau du workflow. La mutation n'a pas l'étape : informative, elle est
  annulée avec le run.
- **L22-04, revue après la CI** : le job `Revue PR (Claude)` est déplacé dans `ci.yml` (`revue-pr.yml` supprimé), avec
  `needs:` sur les huit jobs requis. Conservés à l'identique : nom, permissions (`contents: read`,
  `pull-requests: write`), garde fork ou brouillon (`review-guard.sh`), consignes lues sur le SHA de la base,
  action épinglée, verdict. Seul ajout : `if: github.event_name == 'pull_request' && github.base_ref == 'develop'`
  (avant : `branches: [develop]` du déclencheur). Pas de `workflow_run`.
- **L22-05, mutation** : `MUTATION_FULL` (vrai seulement sur une PR vers `main`) remplace le test d'étiquette : run
  complet sans cache, seuils de rupture compris ; sinon incrémental et informatif. Matrice, délais, cache et
  rapports inchangés.
- **L22-06, front réparti** : `front-qualite` (lint, typecheck, couverture, 20 min) et `front-parcours`, matrice de 7
  jobs (un par projet Playwright, 20 min chacun), `fail-fast: false`.
  - Matrice par projet plutôt que `--shard` : noms de contrôles stables (un échec nomme la taille), pas de
    répartition qui dépend du nombre de tests, pas de fusion de rapports.
  - Chaque job : installation, `pnpm e2e:browsers:up`, `pnpm --filter @siteperso/contracts build`, puis
    `pnpm --filter @siteperso/web run test:e2e --project=<nom>` (génération sur fixtures + Playwright).
  - `turbo.json` : `@siteperso/web#test:e2e` dépend de `^build`, `lint`, `typecheck`, `test:coverage` ; passer par
    turbo les rejouerait dans les sept jobs. J'appelle donc le script du paquet, précédé de la seule compilation des
    contrats (que le front lit en `dist/`). `--only` aurait aussi convenu ; l'appel direct évite en plus le filtrage
    d'environnement de turbo (`CI` et `NUXT_*` passent tels quels).
  - `--concurrency=1` **conservé** sur `front-qualite` : lint, typecheck et couverture en séquence coûtent peu de
    minutes ; je n'ai pas pu mesurer que le `HookTimeoutError` du lot 21 a disparu sans les parcours, et le retirer sans
    mesure réintroduirait un échec intermittent (à réévaluer sur les temps du premier run). Le délai de 40 min est
    retiré (20 min par job).
- **Docs** : `docs/deploiement.md` : section « Déclencheurs de la CI », liste des quinze contrôles requis, JSON du
  ruleset, mention du run complet de mutation sur PR vers `main`.
- Vérifications ciblées : `pnpm lint:workflows` (actionlint) propre, Prettier propre sur `ci.yml`, pre-commit vert
  (au deuxième essai, voir plus bas).

## Contrôles requis (noms exacts, quinze)

1. `Qualité (format, lint, typecheck, build, tests)`
2. `Garde-fous (intégrité des tests, hooks des agents)`
3. `Tests e2e et couverture 100 % (PostgreSQL 16)`
4. `Front (lint, typecheck, couverture 100 %)`
5. `Front parcours Playwright + axe (mobile-390)`
6. `Front parcours Playwright + axe (tablette-834)`
7. `Front parcours Playwright + axe (portable-1024)`
8. `Front parcours Playwright + axe (desktop-1280)`
9. `Front parcours Playwright + axe (grand-1440)`
10. `Front parcours Playwright + axe (fullhd-1920)`
11. `Front parcours Playwright + axe (ultra-3440)`
12. `Analyse statique (actionlint des workflows, shellcheck des scripts)`
13. `Image Docker de l'API (build sans push)`
14. `Pile locale complète (Caddy, API, PostgreSQL) et scénarios de production`
15. `Revue PR (Claude)`

## Temps attendu

Run 44928473401 (lu par `gh run view`) : job Front unique 32 min ; qualité 4 à 5 min ; pile locale 2 min ; docker 1 min.
Attendu maintenant : jobs de qualité et de contrats 4 à 6 min, `front-qualite` environ 5 à 7 min, chaque parcours
environ 8 à 12 min (installation 1 min, image Playwright 1 à 2 min, génération 1 à 2 min, un écran sur 26,8 min
de parcours au total, `ultra-3440` probablement le plus long). Durée de bout en bout de la CI : environ 12 min,
la revue Claude s'y ajoute ensuite (jusqu'à 20 min). Mutation en parallèle : complète sur PR vers `main` (API jusqu'à 150 min).

## Non fait / décisions

- Aucun run réel : rien n'a été poussé (consigne). Tout ce qui suit reste à observer sur la première PR.
- Le premier `git commit` a échoué au pre-commit sur `@siteperso/web#test` (turbo lance lint, typecheck et tests en
  parallèle) ; le même test, relancé seul, passe (96 fichiers, 994 tests). C'est le symptôme du lot 21 (démarrage de
  l'environnement Nuxt de Vitest sous charge), observé en local : argument de plus pour garder `--concurrency=1` en CI.

## Points ouverts : ce que le premier run de la PR doit montrer

1. Les quinze contrôles apparaissent avec ces noms exacts (un nom de matrice n'est proposé au ruleset qu'après avoir
   tourné) ; Julien pose alors la protection avec la liste de `docs/deploiement.md`.
2. `gh run cancel` : sur un échec volontaire (à ne pas commiter), le run entier s'annule, mutation et revue comprises.
   Le job fautif peut s'afficher « annulé » au lieu d'« échoué » (annulation reçue pendant son étape finale) ;
   si GitHub ne bloque alors pas la fusion comme prévu, retirer l'annulation ou la déporter dans un job `needs`.
3. Temps réels des parcours par taille (`gh run view --json jobs`) : ajuster les 20 min, vérifier `ultra-3440`.
4. `--project=<nom>` bien transmis par `pnpm run` au script (`generate:fixtures && playwright test --project=…`) :
   sept jobs ne doivent exécuter chacun qu'un projet.
5. `front-qualite` sans `HookTimeoutError` ; si trois runs consécutifs passent, `--concurrency=1` peut être retiré.
6. La revue Claude ne démarre qu'après les huit jobs verts ; sur une PR en brouillon, elle échoue par la garde.
7. Pas de cache d'incrément de mutation sur `develop` tant qu'aucun `workflow_dispatch` n'a tourné sur `develop`
   (la première mutation incrémentale d'une PR repart de zéro).
8. Compte tenu de la suppression des push sur `develop`, la CI de `develop` après fusion ne tourne plus : c'est la
   décision 2, la PR est la seule vérification.
