# Recette CdP du lot F4 (couche de données du front)

Date : 20 nov. 2026. Branche `lot/F4-donnees` (6 commits depuis 961a2e6, tête 6f71b9e). Isolation : `.env` racine `siteperso-v3-f4` (5902-5905).

## Critères rejoués

| Critère | Commande | Résultat |
| --- | --- | --- |
| Check complet, conteneurs neufs | `TURBO_FORCE=true pnpm check` | 1re passe : code 1 (voir R1) ; 2e passe : code 0. contracts 29 fichiers, api 62 unit + 53 e2e (115 en couverture), web 29 fichiers / 438 tests |
| Couverture 100 % | `test:coverage` dans le check | contracts, api, web : All files 100/100/100/100 |
| Mutation front | `pnpm test:mutation` (apps/web) | 100,00 % : 800 tués + 1 timeout, 0 survivant, 0 sans couverture ; `data/` 230 tués (7 fichiers à 100 %). `stryker.config.mjs` inchangé, aucun `stryker.equivalents.json`, aucune directive Stryker dans `app/` |
| Intégrité | `pnpm integrity develop` | code 0, « OK » ; `git diff --name-status` : que des ajouts, aucun test existant modifié |
| Architecture | `app/architecture.spec.ts` (dans le check) | vert, dont « app/data n'importe pas les composants » |
| Périmètre | `git diff --stat 961a2e6...lot/F4-donnees` | `apps/web/app/data/**` (17 fichiers) + `docs/comptes-rendus/lot-F4-dev-front.md` ; rien d'autre |
| Marqueurs interdits (saut, focus, ignore de couverture, Stryker) | grep dans `app/data` | aucun |

## Données personnelles

- Aucune adresse e-mail, aucun téléphone, aucun `mailto:` ni `tel:` (recherche dans `app/data`) ; un test des fixtures l'interdit aussi.
- Profil des fixtures : `Prénom` / `Nom`, lieu `Ville, Région` / `Town, Region`, liens `https://www.linkedin.com/in/example`. Conforme.
- R2 : les textes des 3 recommandations (FR et EN, 8 occurrences par fichier) contiennent le vrai prénom « Julien » (« Responsable direct de Julien », « Julien a été recruté chez Contentsquare… ») et des noms d'employeurs. Le test `cv-fixtures.spec.ts` ne vérifie que « Lachaux ». Ce sont des citations de tiers déjà publiques (décision du 19 nov.), mais cela contredit « placeholders pour le prénom ».

## Fond

- Mapping `docs/04` : `map-cv.spec.ts` (31 tests) couvre profil, liens, expériences, technos, recommandations, IA ; mutation 100 % sur `map-cv.ts` (87 mutants tués).
- Fixtures validées par `CvSchema` (`cv-fixtures.spec.ts`, 15 tests).
- `ApiCvSource` (`api-cv-source.spec.ts`, 24 tests) : réseau, délai, HTTP avec `detail` du problem+json, JSON invalide, hors contrat avec chemin, langue servie différente : tous testés.
- `fetchCv` (`fetch-cv.spec.ts`, 10 tests) : relève l'erreur de `useAsyncData` et l'absence de donnée, donc la génération échoue.
- Lecture réelle : API du worktree (build, port 5902, `db:reset` sur les seeds), `GET /cv?lang=fr` et `en` : 200 ; `CvSchema.parse` accepte les deux. Comparaison profonde fixtures / réponse réelle : 14 différences par langue, toutes attendues (prénom, nom, lieu, alt du portrait, 2 URL LinkedIn = placeholders ; certifications, formation, langues = tableaux vides dans les fixtures). Expériences, compétences, recommandations, IA identiques. Cartes mappées depuis la lecture réelle : Nopillo (préfixe `@`, « janv. 2026 – mai 2026 », 6 puces + 2 cachées dont `ocr` et `agentic-development`) et la pause professionnelle (préfixe `›`, puce easter egg, organisation « Projet personnel » injectée), en FR et en EN. Je n'ai pas comparé aux images des captures : la comparaison s'appuie sur les fixtures tirées du handoff.
- Les fixtures n'incluent pas certifications, formation, langues que l'API sert : écart de couverture des fixtures, sans effet tant que le front ne les affiche pas.

## Retrait d'un test au hasard (clone jetable)

`shuf` a tiré `api-cv-source.spec.ts`, « réseau : un délai dépassé fait échouer la lecture ». Retiré : 437 tests verts, couverture 100 %, mutation 100 % : la suite ne le détecte pas. Il est redondant avec « borne la lecture par un délai » et « applique le délai demandé » (assertions sur `AbortSignal.timeout`) et le test réseau générique. R3, mineure (test redondant, pas de défaut).

## Journal des garde-fous (dev-front, 20 nov.)

Environ 6 refus pour le rôle dev-front ce jour, tous du même type : script ou cible d'écriture « illisible » (`serve.mjs`, `shoot.mjs`, `gen-fixtures.mjs`, `surv.mjs`, `live.mts`, `probe.mjs`, `$1`, `$f`). Les plus proches de F4 (06:16 à 06:54 UTC) concernent des scripts du scratchpad ; chacun a été suivi d'une autre forme, aucune répétition du même refus, aucune autorisation utilisée pour F4 (les autorisations du jour sont BF-API et BF-8-11, hors lot). Le journal ne porte pas le worktree : attribution par l'heure. Pas de faute relevée.

## Cycles édition-test

Aucun fichier modifié plus d'une fois dans les 6 commits (ajouts seuls) ; transcription non fournie, alternances non mesurées.

## Écarts du dev (tracés, non bloquants)

« À distance » + work mode remote d'OpenClassrooms (« À distance, à distance ») ; `stackLabel` servi pour toutes les expériences ; recommandations `published = true` au seed ; date de recommandation formatée selon sa `locale` ; préfixe déduit de `kind` ; titre coupé dans `data/`.

## Réserves

- R1 : la première exécution de `TURBO_FORCE=true pnpm check` a échoué (code 1) : 15 fichiers du projet Vitest `nuxt` en « Failed to resolve import #app-manifest », pendant que lint et typecheck tournaient en parallèle ; `pnpm test` seul dans `apps/web` et la 2e passe complète sont verts. Course sur `.nuxt` probable (hors F4, aucun code du lot en cause), à surveiller. Les erreurs lint/typecheck du journal ne sont que l'arrêt de turbo après cet échec.
- R2 et R3 ci-dessus.
- Résidu : j'ai construit `apps/api/dist` (gitignoré) pour la lecture réelle et le hook m'interdit de le supprimer ; à effacer par l'orchestrateur. Conteneurs `siteperso-v3-f4` arrêtés (`pnpm db:down`), API arrêtée, clone supprimé.

## Verdict : accepté avec réserves

À trancher : R2 (remplacer « Julien » par un placeholder dans les citations des fixtures et étendre le test, ou l'accepter ?), R1 (course `.nuxt` à investiguer côté outillage).
