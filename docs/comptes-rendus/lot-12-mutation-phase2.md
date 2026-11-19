# Lot 12 : test par mutation, phase 2 (compte rendu du QA, section Tests)

Branche `lot/12-mutation-phase2` depuis `v3/backend` (HEAD `4cc18ab`), 19 novembre 2026.
Autorisation nominative `4affcde4` (ticket MUT-2, portée tests) : aucun test existant n'a eu besoin
d'être retouché, chaque assertion faible a été tuée par un NOUVEAU fichier de test (aucune ligne
`Justification-test` nécessaire). Aucun fichier de production, aucune configuration (Vitest,
Stryker, turbo), aucun test e2e modifié. Isolation Docker `siteperso-v3-lot12` (ports 5812 / 5813).

## Scores avant / après

Mesure de départ regénérée dans ce lot (`pnpm --filter <paquet> test:mutation`), identique à la
phase 1 au mutant près. Score = (tués + timeouts) / (tués + timeouts + survivants + sans couverture).

| Paquet               | Mutants | Score avant | Score après | Score couvert avant / après | Survivants avant / après | Sans couverture avant / après | Durée après |
| -------------------- | ------: | ----------: | ----------: | --------------------------: | -----------------------: | ----------------------------: | ----------- |
| `packages/contracts` |     483 |     32,06 % |   100,00 % |         32,06 % / 100,00 % |                 284 / 0 |                         0 / 0 | 2 min 19 s  |
| `apps/api` (unit)    |    1598 |     32,33 % |    37,15 % |          50,97 % / 58,31 % |               329 / 281 |                     387 / 384 | 9 min 00 s  |

Contracts : 418 tués, 0 survivant, 65 erreurs de compilation (hors score). API : 372 tués,
21 timeouts, 281 survivants, 384 sans couverture, 540 erreurs de compilation.

Seuils de rupture à poser par le lead-architecte (la configuration Stryker m'est interdite) selon le
cadrage (score obtenu, jamais abaissé) : `thresholds.break` **100** pour `packages/contracts`,
**37** pour `apps/api` (37,15 % : marge de 0,15 point, à relever après la phase 3).

## Tests

Avant l'ajout : 104 tests contrats, 315 unitaires API. Après : 133 (+29) et 389 (+74).
`pnpm check` vert avant chaque commit et en fin de lot (hooks 41/41, intégrité, contrats 133, API
389 unitaires + 552 e2e, couverture fusionnée à 100 % sur les quatre métriques) ; passe unitaire en
ordre aléatoire (`--sequence.shuffle.files --sequence.shuffle.tests`) verte pour les deux paquets.

### Contrats (3 commits `test(contracts): mutation, …`)

| Fichier (nouveau)                                          | Cas | Mutants tués |
| ---------------------------------------------------------- | --: | ------------ |
| `src/openapi/document.snapshot.spec.ts` + `src/openapi/__snapshots__/openapi.json` (1277 lignes, formaté Prettier) | 3 | les 259 libellés, descriptions, exemples, `operationId` du document ; ordre alphabétique des composants (`sortComponents`) ; unicité et forme des 13 `operationId` |
| `src/education/education.refinement.spec.ts`               |   3 | `path: ['yearEnd']`, message du refus, objet d'options du `refine` (le champ fautif est désormais vérifié) |
| `src/common/url.protocols.spec.ts`                         |   8 | ancres de `/^https?$/` (`httpx:`, `xhttp:`, `https2:`, `shttps:` refusés ; majuscules acceptées) |
| `src/languages/languages.code.spec.ts`                     |  13 | ancres de `/^[a-z]{2}$/` (`fra`, `xfr`, espaces, saut de ligne final, majuscule, chiffre) |
| `src/common/identifiers.spec.ts`                           |   2 | `PROBLEM_JSON_CONTENT_TYPE` (RFC 9457) ; `id: 'LocaleQuery'` observé par `z.toJSONSchema` (`$ref` et `$defs`) |

Le test d'instantané est la protection voulue par le cadrage : le document généré est le contrat que
le portage Rust devra honorer. Le fichier de référence est produit par `toMatchFileSnapshot` à partir
de `createOpenApiDocument()` mis en forme par `prettier.format` (mêmes options que le dépôt), si bien
que `pnpm format` ne le réécrit pas. Pour accepter un changement voulu du contrat :
`pnpm --filter @siteperso/contracts exec vitest run -u src/openapi/document.snapshot.spec.ts`, puis
relire le diff. Les 25 « assertions faibles » du contrat sont couvertes : certaines par l'instantané
(`operationId`, `sortComponents`), les autres par les trois fichiers ci-dessus.

### API (5 commits `test(api): mutation, …`)

| Zone                    | Fichier (nouveau)                                                 | Cas | Mutants tués (fichier:ligne de production) |
| ----------------------- | ----------------------------------------------------------------- | --: | ------------------------------------------ |
| cas d'usage             | `application/experiences/list-experiences.achievements.spec.ts`   |   2 | `list-experiences.use-case.ts:31` `[...achievements]` → `[]` (ordre et copie : la réponse n'alias pas l'entité) |
| cas d'usage             | `application/profile/get-profile.not-found.spec.ts`               |   1 | `get-profile.use-case.ts:13` (2 mutants : entité `'Profil'` et identifiant `'profile'`, message du 404) |
| configuration           | `infrastructure/config/env.limits.spec.ts`                        |  21 | `env.schema.ts` : `.trim()` de TRUST_PROXY (l.15) ; message du refus (l.29-31) ; valeurs de NODE_ENV (l.41) ; ancres du protocole `DATABASE_URL` (l.44) ; `HOST` (l.43) ; filtre et `trim` de CORS_ORIGIN (l.50-53) ; `min(100)` de `DB_STATEMENT_TIMEOUT_MS` (l.66) |
| base de données         | `infrastructure/db/sql-statements.lexing.spec.ts`                 |  12 | `sql-statements.ts` : `--` (l.25), `/*` (l.28), `index + 2` (l.29), ancre de l'étiquette dollar (l.35), `index + 1` d'une chaîne vide (l.62), ancre du verbe (l.79) |
| base de données         | `infrastructure/db/migrations-runner.listing.spec.ts`             |  15 | `migrations-runner.ts` : ancres de `SQL_FILE_PATTERN` (l.12), `.sort()` (l.49, `readdir` simulé dans le désordre), messages (l.98, l.120), requêtes de `findPendingMigrations` (l.186, l.190) et sa garde `if (tables[0]?.present)` (l.189) |
| base de données         | `infrastructure/db/drizzle-database-client.wire.spec.ts`          |   5 | `drizzle-database-client.ts` : options du pool (l.33, l.38 : `statement_timeout` lu sur le message de démarrage d'un faux serveur PostgreSQL), `select 1` du ping (l.53), `clearTimeout` (l.56-57), `drizzle(sql, { schema })` (l.42) |
| base de données         | `infrastructure/db/drizzle-database-client.close.spec.ts`         |   1 | `close()` (l.62-63) : `sql.end({ timeout: 5 })` appelé et attendu |
| base de données         | `infrastructure/db/database.module.spec.ts`                       |   1 | `database.module.ts:31` `onModuleDestroy` (sans couverture unitaire jusque-là) |
| HTTP                    | `infrastructure/http/health/health.controller.message.spec.ts`    |   1 | `health.controller.ts:14` message du 503 |
| HTTP                    | `infrastructure/http/problem/problem-details.statuses.spec.ts`    |  15 | `problem-details.ts` : titres 406, 413, 415, 422 (l.11-14) ; détail du 503 de délai (l.79) ; `exception.code === code` (l.43) ; borne `< 500` (l.82, statusCode 500 exactement) |

Chaque test décrit un comportement (refus d'un nom, contenu d'une erreur, octets émis vers le
serveur) et non la ligne mutée. Le faux serveur PostgreSQL du client Drizzle accepte
l'authentification (`AuthenticationOk` + `ReadyForQuery`) puis ne répond pas : il rend observables
les paramètres de connexion et le SQL émis, sans base.

### Assertions renforcées (MUT-2)

Aucune : tout a été ajouté dans de nouveaux fichiers. L'autorisation MUT-2 n'a pas servi.

## Survivants restants (API, 281) : classement pour le lead-architecte

Contrats : aucun survivant, aucun sans couverture.

### Équivalents probables (à déclarer ; 15 mutants hors schéma)

| fichier:ligne                                      | Mutant                                                                 | Pourquoi équivalent |
| -------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `infrastructure/config/env.schema.ts:76`           | `.default('false')` → `.default("")`                                   | `TrustProxySchema` lit `''` et `'false'` de la même façon (`false`). |
| `infrastructure/db/sql-statements.ts:60`           | `index < content.length` → `<=`                                        | `charAt` hors borne rend `''`, la boucle sort et la fonction rend `content.length` dans les deux cas. |
| `infrastructure/db/sql-statements.ts:62` (3 mutants) | `charAt(index + 1) === quote` → `false`, `content`, bloc vidé         | Fermer puis rouvrir une chaîne (`''` doublé) donne les mêmes positions de découpe que de sauter les deux apostrophes. |
| `infrastructure/db/sql-statements.ts:78` (2 mutants) | `\s+` → `\s` ; `(?:\n\|$)` → `(?:\n)`                                  | Le `+` extérieur répète déjà le groupe ; un commentaire final sans saut de ligne reste en tête de chaîne et `^[A-Za-z]+` rend `''` comme avec la suppression. |
| `infrastructure/http/problem/problem-details.ts:31` (2 mutants) | borne haute `code <= 599` → `true` / `< 599`              | Le seul usage de `statusCodeOf` est suivi de `fastifyStatus < 500` (l.82) : toute valeur de 500 à 599 et au-delà conduit au même 500 générique. Branche défensive redondante. |
| `infrastructure/http/problem/problem-details.ts:53` | `typeof response === 'object' && 'message' in response` → `true`      | Sans `message`, `response.message` vaut `undefined` et la fonction rend `undefined` comme avant ; un `null` lève dans les deux cas. |

### Relèvent des e2e (phase 3 ; 11 mutants hors schéma + 384 sans couverture)

| fichier:ligne                                                              | Mutant                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| `infrastructure/db/experiences/drizzle-experiences.repository.ts:44`       | `eq(experiences.published, true)` → `false`             |
| `infrastructure/db/skill-groups/drizzle-skill-groups.repository.ts:31`     | `eq(skillGroups.published, true)` → `false`             |
| `infrastructure/db/skills/select-published-skills.ts:39` et `:45`          | `eq(skillGroups.published, true)` / `eq(skills.published, true)` → `false` |
| `infrastructure/http/create-app.ts:14`                                     | `GLOBAL_PREFIX = 'api/v1'` → `""`                       |
| `infrastructure/http/create-app.ts:27` (6 mutants)                         | `CSP_DIRECTIVES` : objet vidé, tableaux vidés, `"'none'"` → `""` |
| `infrastructure/http/create-app.ts:28`                                     | `CONTENT_SECURITY_POLICY` → `""`                        |

Sans couverture unitaire (384, tout SQL réel ou démarrage de l'application) : `seeds-convergence`
123, `deleted-entities` 91, `seeds-runner` 39, `create-app` 37, `migrations-runner` 33,
`provision-api-role` 33, `reset-database` 13, `projects` 8, `resources` 2, et un mutant dans chacun
des dépôts `certifications`, `education`, `languages`, `social-links`, `tools`.

### À exclure par motif (cadrage : métadonnées déclaratives du schéma Drizzle, contexte de journal)

`infrastructure/db/schema/*.ts` : 259 survivants, répartis en : noms de tables et de colonnes SQL 94
(relève aussi de `test/db/schema-matches-db.e2e-spec.ts`, donc des e2e), valeurs d'`enum`/`mode` 40,
`.default(…)` 34, noms d'index et d'unicité 19, `references`/`onDelete` 18, `primaryKey`,
`localeCode` et noms de tables 54 (le SQL de `db/migrations` fait foi, ces métadonnées ne sont lues
par aucune requête des dépôts). Motif proposé : « métadonnées déclaratives du schéma Drizzle » pour
`.default`, `enum`, index, `references`, `primaryKey` ; les noms de tables et de colonnes restent
candidats à la phase 3 (comparaison à `information_schema`).

`infrastructure/http/problem/send-problem.ts:7` : `new Logger('ProblemDetails')` → `new Logger("")`
(1 mutant, motif « contexte des messages de journal »).

## Décisions

- Instantané du document dans `src/openapi/__snapshots__/openapi.json` (convention Vitest) plutôt
  qu'à côté du test : le dossier est déjà un oracle pour les garde-fous.
- `prettier.format` dans le test d'instantané plutôt qu'un `JSON.stringify` brut : Prettier replie
  les petits tableaux, un fichier brut aurait été réécrit par `pnpm format` et le test aurait
  échoué après chaque formatage.
- Faux serveur PostgreSQL de 15 lignes plutôt que `vi.mock('postgres')` : il vérifie les octets
  réellement émis (`statement_timeout`, `select 1`) sans dépendre de l'API interne du pilote.
- `readdir` simulé (`vi.mock('node:fs/promises')`) pour prouver le tri de `listSqlFiles` : sur ce
  système de fichiers `readdir` rend déjà l'ordre alphabétique, le mutant `.sort()` supprimé
  survivait pour cette raison.
- Mutants équivalents non tués par un test artificiel : listés ci-dessus pour décision.

## Non fait

- Survivants et sans couverture qui relèvent des e2e : phase 3, non traités (consigne).
- Aucun seuil, aucune exclusion, aucune modification de `.github/workflows` : fichiers protégés.
- Test d'ordre aléatoire e2e non rejoué : aucun test e2e n'a été ajouté ni modifié ; la passe
  aléatoire a porté sur les unitaires.

## Points ouverts

- **Dépendance à déclarer** (signalée, non appliquée : `package.json` partagé) : le test
  d'instantané importe `prettier`, aujourd'hui seulement présent à la racine (3.10.1, résolu par
  remontée de `node_modules`). Ajouter `"prettier": "3.10.1"` aux `devDependencies` de
  `@siteperso/contracts` pour que le paquet reste autonome.
- **Évolution du contrat** : `__snapshots__/` est un oracle des garde-fous. Toute modification
  voulue du document OpenAPI (nouveau champ, libellé) exigera une autorisation nominative pour
  mettre à jour le fichier existant, et une ligne `Justification-test` dans le commit. À prévoir
  dans le processus de changement de contrat.
- **Seuils** : voir « Scores » (100 contrats, 37 API) ; `thresholds.break` et le motif d'exclusion
  se posent dans `stryker.config.mjs` (oracle « config », hors de mon rôle).
- **Durée CI** : 2 min 19 s (contrats) et 9 min (API) sur 8 cœurs ; le job CI dédié devrait prévoir
  3 à 4 fois plus sur 4 cœurs (voir lot 11), ou le mode `incremental` de Stryker.
- **e2e** : cette branche compte 41 fichiers et 552 tests e2e contre 39 et 544 annoncés au lot 11 ;
  écart déjà présent sur `v3/backend` (je n'ai touché à aucun e2e), à signaler à qui tient la synthèse.
