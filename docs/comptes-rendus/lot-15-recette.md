# Lot 15 : recette du chef de projet (brief back-001)

Date : 20 novembre 2026. Branche `lot/15-brief-back-001`, tête 36cb050, 29 commits, base 09b7f0c.
Recette dans un clone jetable (isolation `siteperso-v3-recette15`, ports 5722 à 5725), pas dans le worktree.

## Verdict : acceptée

Aucun critère en échec, aucun test existant modifié sans justification, `pnpm check` vert. Trois questions à
trancher par l'orchestrateur ou Julien en fin de document (aucune ne bloque).

## 1. Critères rejoués

| Critère | Commande | Résultat |
| --- | --- | --- |
| Check complet | `pnpm check` (clone neuf, base neuve) | code 0 ; couverture 100 % (API : 765/765 instructions, 232/232 branches, 276/276 fonctions, 745/745 lignes ; contrats : 59/59 et 2/2) |
| Intégrité des tests | `pnpm integrity base15` (base = 09b7f0c) | « Intégrité des tests : OK », code 0 |
| Marqueurs interdits | recherche, dans les lignes ajoutées hors docs, des marqueurs de saut ou de focus de Vitest, des commentaires d'ignore de couverture et des directives de désactivation de Stryker | aucune occurrence |
| Configurations protégées | `git diff --stat` sur `*.config.*`, `stryker*`, `turbo.json`, `.github`, `scripts`, `.husky`, `.claude` | aucun fichier touché ; `stryker.equivalents.json` inchangé, aucun équivalent déclaré |
| Migrations 0011 à 0016 | `pnpm db:reset` sur base vide | les migrations s'appliquent, 7 seeds exécutés |

## 2. Diff des tests (point 1 demandé)

27 fichiers de test, fixtures ou support existants modifiés (149 insertions, 45 suppressions), aucun supprimé.
J'ai lu le diff complet (552 lignes). Chaque modification est portée par un commit avec `Justification-test: BF-n` :

- BF-1 (65061aa, 6595c95, ef1508e) : profils des fixtures (`profile.spec`, `cv.fixtures`, `get-profile`,
  `get-cv`, `controllers.spec`) et titre attendu « Développeur full-stack ». Seules les valeurs et les clés
  changent. `schema-constraints` : l'insertion de contrôle de `locale_code_check` cite les nouvelles colonnes et
  vise toujours la même contrainte (assertion intacte).
- BF-2 : `experiences.e2e` (deux listes de compétences de nopillo : `ocr`, `agentic-development` ajoutés en fin,
  conforme au seed du brief), `seeds.e2e` (motif `', true'`), fixtures `shownInStack`.
- BF-3 : `mainStackOrder` dans les fixtures et les doublures proxy ; aucune assertion affaiblie.
- BF-4 / BF-5 : compteurs de tables (26 puis 29), de routes (14), de chemins (15), clés du CV
  (`recommendations`, `aiOverview`), `ENDPOINTS`, `TRANSLATION_TABLES`, `CONTENT_TABLES`, composants nommés. Les
  égalités exactes sont conservées, seuls les nombres et listes attendus évoluent.
- BF-6 : `social-links.e2e` et `seededCount` 1 puis 2.
- Instantané `openapi.json` : régénéré sous l'autorisation « tests » ab03b52f dont les chemins incluent les
  instantanés ; `pnpm check` et les tests de conformité confirment son accord avec le contrat. dev-api avait d'abord
  tenté la mise à jour d'instantané par l'option `-u` de Vitest (refusée), puis un script de génération : voie
  différente, sous autorisation, pas de répétition du même refus.
- Étape 3 (ef1508e) : la justification parle de tests de complétude « de l'étape 2 ». Ces tests sont des ajouts de
  ce lot (absents de la base 09b7f0c), leur remplacement n'a donc touché aucun test existant de `develop`.

Chaque contrainte de la migration 0016 a un test qui la viole (`apps/api/test/db/front-profile.e2e-spec.ts`) :

| Contrainte | Test |
| --- | --- |
| 9 `not null` (`title_badge`, `taglines`, `intro`, `mission`, `current_activity`, `seeking_format`, `seeking_location`, `seeking_availability`, `cv_path`) | `it.each(NEW_COLUMNS)('refuse une valeur nulle …')` (message `null value in column`) et contrôle `is_nullable = NO` |
| 8 checks `<> ''` nommés `profile_translations_<colonne>_check` | `it.each(TEXT_COLUMNS)('refuse une valeur vide …')`, regex sur le nom de la contrainte |
| `taglines_check` (3 conditions) | `it.each` : tableau vide, accroche vide, accroche nulle ; plus un cas accepté (une seule accroche) |
| Colonnes supprimées | contrôle d'absence de `headline`, `bio`, `availability` |
| Seed qui vide une colonne | seed externe `0099` refusé avec le nom de la contrainte (`seeking_location`) |

Tests équivalents pour 0014 (recommandations) et 0015 (section IA) : `front-recommendations.e2e-spec.ts` et
`front-ai-overview.e2e-spec.ts` présents ; `main_stack_order` (rang unique, positif) et `shown_in_stack` (défaut)
également.

## 3. Journal des garde-fous

Trois autorisations « tests », toutes révoquées : 89f3baac (dev-sql, 8 usages), ab03b52f (dev-api, 68 usages),
af932f7f (dev-sql, 11 usages). Tous les usages portent sur des chemins couverts par leur périmètre.
Refus du lot : dev-sql 2 (écriture opaque python3 sur un oracle), dev-api 5 (python3 opaque ; mise à jour
d'instantané par `-u` ; script écrit et lancé par la même commande ; `perl` en ligne ; écriture dans un dossier
contenant des oracles). Chaque refus a été suivi d'une voie différente et licite, pas d'insistance sur la même
forme. Aucune violation de fin de tâche dans le journal. Les refus attribués à `lead-architecte` (lot F0, hors
lot 15) ne concernent pas ce lot.

## 4. Cycles édition-test

Fichiers les plus modifiés : 5 commits (`openapi.json`, `cv.fixtures.ts`, `get-cv.use-case.spec.ts`,
`docs/traductions-a-relire.md`), soit un par ticket BF : le seuil de cinq n'est pas dépassé. Transcriptions non
fournies : alternances non comptées ; l'historique ne montre pas de tâtonnement (un commit par ticket, tests et
code livrés ensemble).

## 5. Retrait d'un test au hasard

Tirage (`shuf -n 1` parmi les cas ajoutés par le lot) :
`packages/contracts/src/recommendations/recommendations.spec.ts:60`, « refuse une clé inconnue (sortOrder,
published, email) ». Retiré dans un clone jetable, `pnpm test:coverage` : **code 0, tout reste vert** (100 %
partout). Constat : le test garde le caractère strict du schéma, que la couverture de lignes ne peut pas voir. Il
n'est donc pas redondant, mais la couverture seule ne le protège pas ; c'est la mutation sur les contrats (100 %,
voir ci-dessous) qui le protège. Un second tirage (apps/api, `select-published-skills.published.spec.ts`) a été
fait mais pas exécuté (7 minutes par essai, même nature : assertion sur le SQL, invisible de la couverture).

## 6. Tests de réserve (hors dépôt, scratchpad)

36 scénarios générés (script Node avec Ajv sur `packages/contracts/dist/openapi.json`), API du lot démarrée sur
la base seedée : 8 routes tirées au hasard (`profile`, `social-links`, `cv`, `certifications`, `languages`,
`skill-groups`, `recommendations`, `projects`) en `fr` et `en` avec validation du schéma de réponse (16),
`lang=de` (3, 400 problem+json), paramètre inconnu (3, accepté en 200), `/recommendations/x` en 404,
`POST`/`PUT`/`DELETE` sur `/ai-overview` (405 avec `Allow: GET, HEAD, OPTIONS`), en-têtes de sécurité et
`content-type`, repli `en` des recommandations (`locale = fr`, ordre `sort_order`), profil sans anciens champs et
`cvPath` relatif, `mainStackOrder` (typescript, nodejs, nestjs, vuejs, postgresql, kafka, docker), cohérence de
`/cv` avec les routes, 8 liens cachés du brief, `linkedin-recommendations`, `HEAD`.
Complément à la main : section IA marquée supprimée : `GET /ai-overview` 404 problem+json, `aiOverview` null dans
`/cv` ; recommandations dépubliées : liste vide. Base remise en état.

Échecs : 1 (S13), **faux positif de mon scénario** : `/projects` renvoie `[]` sur la base seedée (aucun projet
seedé), donc les compétences imbriquées ne sont pas vérifiables en direct. Elles le sont par les unitaires et le
contrat. Reproduction : `curl http://localhost:3000/api/v1/projects` renvoie `[]`. Aucun échec de l'API.

## 7. Mutation (point 3)

Rejouée (`pnpm test:mutation`, 14 min 36 s) :

- Contrats : 100,00 % (513 tués, 0 survivant, 0 sans couverture), seuil 100 tenu.
- API : **42,03 %** (398 tués, 21 timeouts, 204 survivants, 374 sans couverture, 495 erreurs de compilation),
  seuil 40 tenu. C'est le chiffre de dev-sql, reproduit à un mutant près (un seul fichier diffère,
  `sql-statements.ts` : un tué devenu timeout). Référence `develop` : 40,77 %.

Pour juger l'explication de dev-sql, j'ai aussi mesuré le commit de fin d'étape 2 (750eb4c) : **42,89 %** (410 tués,
21 timeouts, 200 survivants), et non 46,37 %. Comparaison par fichier entre 750eb4c et 36cb050 : seuls deux
fichiers diffèrent.

- `drizzle-profile.repository.ts` : 5 tués, 0 survivant, puis plus aucun mutant évaluable (code de complétude supprimé).
- `schema/profile.ts` : 7 tués et 17 survivants, puis 0 tué et 21 survivants. Les 7 tués étaient des noms de
  colonnes des colonnes transitoires, tués par l'ancienne condition de complétude ; ils sont maintenant du même
  type que les autres littéraux de noms de colonnes du schéma (survivants connus, vérifiés seulement par les e2e,
  que Stryker ne lance pas).

Conclusion : l'explication tient, avec une précision. Les 46,37 % de dev-api ne sont pas reproductibles : mesuré
au même commit, le score est 42,89 %, l'écart venant de 35 timeouts de moins (comptés comme tués, ils basculent en
survivants selon la charge). La perte propre à l'étape 3 est de 0,86 point (42,89 puis 42,03), exactement les
mutants des deux fichiers ci-dessus. Aucun survivant nouveau dans du code atteignable par les unitaires, hormis
4 littéraux de noms de colonnes. Aucun test à ajouter.

Point à décider : le seuil `break` de l'API reste à 40 ; la règle du dépôt demande de le relever au score obtenu.
Les scores mesurés vont de 42,03 à 42,89 selon la variabilité des timeouts : un `break` à 42 passerait avec 0,03
point de marge sur le plus bas. À trancher (question 1).

## 8. Documentation (point 4)

- `docs/01-modele-de-donnees.md` : colonnes de `profile_translations`, `main_stack_order`, `shown_in_stack`,
  tables `recommendations`, `ai_overview`, `ai_overview_skills`, routes `/recommendations` et `/ai-overview`
  (404 si absente, vérifié en direct), `aiOverview` null dans `/cv`, `mainStackOrder` et `shownInStack` :
  conformes aux migrations 0011 à 0016 et au comportement mesuré.
- `packages/contracts/README.md` : « 15 chemins », liste des ressources complétée : conforme au document (15 chemins).
- `db/README.md` mis à jour (lignes uniques, repli sans traduction `en`).
- Remarque mineure : `docs/01` donne l'exemple `cv_path` « `/cv.pdf` » alors que le seed sert `/cv/cv-fr.pdf` ; sans
  conséquence (exemple du motif).
- Références périmées à `headline`, `bio`, `availability` : plus aucune dans le code ni dans les docs vivants (restent
  des mentions historiques dans les comptes rendus, `docs/compte-rendu-2026-11-18.md` et `docs/lots.md`, normales).

## 9. Écarts au brief (consignés, non bloquants)

1. BF-4 : `published = true` au lieu de false (décision de Julien du 19 nov., documentée en tête du seed).
2. BF-4 : slugs des recommandations `alexis-coudeyras`, `steeve-chevry`, `eric-bisceglia` (choix de l'agent).
3. Libellés EN à relire : inscrits dans `docs/traductions-a-relire.md` (profil, lien social, deux renommages,
   section IA) ; les trois citations restent FR seul, repli vérifié (`locale = fr`).
4. BF-1 : `cvPath` restreint à un chemin relatif au site (un seul `/` en tête, sans espace).
5. BF-3 : `mainStackOrder` présent dans les compétences imbriquées des projets (question posée à Julien).
6. Contraintes `<> ''` et au moins une accroche ajoutées en base (le brief demande des champs non vides).

## 10. Questions fermées

1. Faut-il relever le `break` de la mutation API de 40 à 42, au risque d'un échec du job CI si les timeouts
   varient encore ?
2. Julien confirme-t-il que `mainStackOrder` reste dans les compétences imbriquées de `/projects` ?
3. Julien relit-il les libellés EN de `docs/traductions-a-relire.md` avant la fusion dans `main` ?

Nettoyage : conteneurs `siteperso-v3-recette15` arrêtés, clones supprimés.
