# Lot 15, étape 1 : SQL, seeds et schéma Drizzle (dev-sql)

Branche `lot/15-brief-back-001` (depuis `develop` 09b7f0c). Source : `docs/briefs/back-001-donnees-front.md`
(BF-1 à BF-6) et `docs/04-front-donnees.md`. Étape « ajouts seulement » : rien n'est supprimé, l'API compile
et ses tests passent à chaque commit. Isolation Docker `siteperso-v3-lot15` (ports 5712 et 5713).

Résultat : `pnpm check` vert (garde-fous, intégrité des tests, lint, typecheck, unitaires, e2e 605, couverture
fusionnée **100 %** sur les quatre métriques : instructions 725/725, branches 226/226, fonctions 255/255,
lignes 706/706) ; `pnpm db:down` en fin de lot. 29 tables au lieu de 24.

## Fait, par ticket

| Ticket | Migration | Seed | Schéma Drizzle | Tests ajoutés |
| --- | --- | --- | --- | --- |
| BF-1 | `0011_profile_front_columns.sql` : neuf colonnes **nullables** sur `profile_translations` | `0001_profile.sql` : `title` « Développeur full-stack », neuf colonnes FR du handoff et EN à relire | `profile.ts` : neuf colonnes nullables | `front-profile.e2e-spec.ts` (6) |
| BF-2 | `0012_experience_skills_shown_in_stack.sql` : `shown_in_stack boolean not null default true` | `0004_experiences.sql` : colonne dans l'upsert, les 8 liens cachés (`false`) du brief | `experiences.ts` | `front-experience-skills.e2e-spec.ts` (5) |
| BF-3 | `0013_skills_main_stack_order.sql` : `smallint null`, check `> 0`, index unique partiel `where not null` | `0003_skills.sql` : rangs 1 à 7, `null` ailleurs, deux noms FR courts | `skills.ts` (index unique partiel déclaré) | `front-skills-main-stack.e2e-spec.ts` (7) |
| BF-4 | `0014_recommendations.sql` : `recommendations`, `recommendations_translations` | `0006_recommendations.sql` : 3 entrées, FR seul, `published = true` | `recommendations.ts` | `front-recommendations.e2e-spec.ts` (16) |
| BF-5 | `0015_ai_overview.sql` : `ai_overview`, `ai_overview_translations`, `ai_overview_skills` | `0007_ai_overview.sql` : FR du handoff, EN à relire, tags `mastra`, `agentic-development` | `ai-overview.ts` | `front-ai-overview.e2e-spec.ts` (17) |
| BF-6 | aucune | `0002_social_links.sql` : `linkedin-recommendations` (kind `linkedin`, sort_order 2), libellés FR et EN | aucun | `front-social-links.e2e-spec.ts` (2) |

Soft delete et convergence (règles du lot 9) pour les nouvelles entités : `recommendations` et `ai_overview` sont
ajoutées à `SEEDED_ENTITIES` (`seeds-convergence.ts`), donc : `deleted_at` marqué quand une recommandation disparaît
des seeds et remis à `null` si elle revient, traductions et liaisons (`ai_overview_skills`) supprimées si absentes
des seeds, contrôle `fr` pour toute ligne publiée non marquée, contrôle de complétude `en` ; `db:deleted:list` et
`db:deleted:purge` les connaissent (même liste). Prouvé par les nouveaux e2e (marquage, remise en service,
liste, simulation, purge avec cascade).

Vérification manuelle (base de dev) : `pnpm db:reset`, puis `pnpm db:seed` deux fois ; l'empreinte md5 du contenu des
29 tables est identique après le reset, après le premier et après le second rejeu. Et les seeds rejoués laissent le
contenu identique : le test existant `seeds.e2e-spec.ts`
(« second passage laisse le contenu de chaque table identique (md5) ») parcourt dynamiquement toutes les tables
publiques, donc les cinq nouvelles aussi.

## Décisions

- **Colonnes de BF-1 nullables à cette étape**, sans contrainte : les lignes existantes (et le test existant
  `schema-constraints` qui insère un profil avec les seules anciennes colonnes) restent valides. Les contraintes
  (non vide, `taglines` d'au moins un élément) arrivent avec le `not null` à l'étape 3, comme demandé. Un test
  vérifie que les seeds les renseignent toutes, dans les deux langues, avec 2 accroches.
- `title` : seule la valeur change (FR « Développeur full-stack », EN « Full-stack developer ») ; type et
  nullabilité inchangés (le test de concordance schéma/base le garde).
- **Libellé des lignes uniques sans slug** : `seeds-convergence.ts` codait `'profil'` en dur pour le profil. Avec
  `ai_overview`, `SeededEntity` devient une union (`hasSlug: true` ou `hasSlug: false` + `label`) et un helper
  `entityLabel` sert les trois contrôles et `deleted-entities.ts`. Sortie inchangée pour le profil (`profil`),
  `ai-overview` pour la section IA. Couverture : les deux branches sont exercées par les e2e existants et nouveaux.
- **Contraintes ajoutées aux nouvelles tables** (non demandées explicitement, cohérentes avec le contrat « champs
  non vides » et le choix du lot 8) : `author_name`, `author_role`, `relationship`, `title`, `in_product_label`,
  `daily_label`, `daily_text` `<> ''` ; `paragraphs` et `in_product_items` d'au moins un élément, sans élément vide
  ni nul. Conséquence : une traduction `en` lacunaire de ces deux entités est impossible en base (un tableau vide est
  refusé), ce qui est voulu.
- **`ai_overview`** : pas de colonne `published` (le brief n'en prévoit pas, comme `profile`) ; `id smallint`
  `check (id = 1)`. L'écriture du seed est `on conflict (id) do update set id = excluded.id` (nécessaire pour que
  la ligne compte comme « écrite » par la transaction de seed, sur laquelle repose la convergence).
- **Noms EN des deux renommages de BF-3** : le brief dit « EN à relire » sans donner de texte. Proposés, pour rester
  alignés sur les noms courts FR : « Managed cloud » et « Production diagnosis » (listés dans
  `docs/traductions-a-relire.md`, qui remplace les anciennes lignes).
- **Libellés du lien BF-6** (le brief dit « libellés FR/EN » sans texte) : « Recommandations publiées sur
  LinkedIn » (texte du design, `SPEC.md` §Recos) et « Recommendations published on LinkedIn » (EN à relire).
  L'URL est celle de `profile.links.linkedinRecommendations` du handoff, telle quelle.
- **Slugs de recommandations** (non précisés par le brief) : `alexis-coudeyras`, `steeve-chevry`,
  `eric-bisceglia`. `sort_order` 1 à 3 dans l'ordre du handoff.
- Les liens cachés de BF-2 sont placés après les puces de leur expérience (sort_order suivant) ; les 6 slugs de compétences
  et 4 slugs d'expériences du brief existent tous dans les seeds (aucun manque, pas d'arrêt).

## Écarts au brief, par ticket

- **BF-1** : aucun (nullabilité transitoire voulue par l'orchestrateur, voir Décisions).
- **BF-2** : aucun.
- **BF-3** : aucun.
- **BF-4** : **`published = true`** au lieu de `false`. Décision de Julien le 19 novembre 2026 : ces
  recommandations sont déjà publiques sur internet (LinkedIn), aucun accord des auteurs n'est nécessaire. Consigné
  en commentaire d'en-tête de `db/seeds/0006_recommendations.sql`. Conséquence : le front ne verra pas l'état vide
  prévu pour la section Recos.
- **BF-5, BF-6** : aucun.

## Tests existants modifiés (autorisation « tests » 89f3baac, ticket BF-SQL)

Chaque commit porte `Justification-test: BF-n <raison>`. Seules les valeurs attendues changent.

| Fichier | Test | Avant | Après | Ticket |
| --- | --- | --- | --- | --- |
| `test/profile.e2e-spec.ts` | « répond 200 en français par défaut… » | `title` = « Développeur full-stack TypeScript senior » | `title` = « Développeur full-stack » | BF-1 |
| `test/experiences.e2e-spec.ts` | « imbrique les compétences dans l'ordre de experience_skills.sort_order » | 6 slugs pour nopillo (jusqu'à `docker`) | 8 slugs : + `ocr`, `agentic-development` | BF-2 |
| `test/experiences.e2e-spec.ts` | « exclut l'expérience non publiée et la compétence non publiée » | 5 slugs (sans `docker`) | 7 slugs : + `ocr`, `agentic-development` | BF-2 |
| `test/db/seeds.e2e-spec.ts` | « supprime une liaison et une traduction retirées d'un fichier de seed » | motif `"  ('nopillo', 'docker', 6),\n"` | `"  ('nopillo', 'docker', 6, true),\n"` | BF-2 |
| `test/db/seeds.e2e-spec.ts` | « refuse un slug inconnu dans une liste de liaisons… » | motif `('nopillo', 'elysia', 2)` | `('nopillo', 'elysia', 2, true)` | BF-2 |
| `test/db/schema-matches-db.e2e-spec.ts` | « déclare les N tables du schéma » | 24 | 26 (BF-4), puis 29 (BF-5) | BF-4, BF-5 |
| `test/social-links.e2e-spec.ts` | « trie par sort_order et exclut les liens non publiés » | `['test-premier', 'linkedin', 'test-sans-en']` | `['test-premier', 'linkedin', 'linkedin-recommendations', 'test-sans-en']` | BF-6 |
| `test/support/endpoints.ts` | `seededCount` de `/api/v1/social-links` (lu par `harness` et `matrix`) | 1 | 2 | BF-6 |

Les deux tests d'`experiences` changeront encore à l'étape 2 (dev-api) : l'API devra alors exposer `shownInStack`
pour chaque lien ; la liste des slugs attendue (8 et 7) est déjà celle de l'état final.

## Non fait (par construction de l'étape)

- Aucune suppression : `headline`, `bio`, `availability` restent en base, dans le schéma Drizzle et dans le seed.
- Ni contrat, ni dépôt, ni route (étape 2, dev-api) : l'API ne lit aucune nouvelle colonne ni nouvelle table. Les
  liens cachés de BF-2 sont déjà servis par `/experiences` et `/cv` (sans indicateur) tant que l'étape 2 n'a pas
  filtré ou marqué : voir Points ouverts.
- `docs/01-modele-de-donnees.md` non modifié (hors du périmètre de dev-sql) : à compléter avec les cinq tables et les
  colonnes de BF-1 à BF-3 par l'orchestrateur ou le lead-architecte. `db/README.md` mis à jour (liste des entités).

## Étape 3 : ce qu'il faudra changer

`profile_translations` (migration `0016_…`), après que l'étape 2 a basculé l'API sur les nouvelles colonnes :

1. Passer `NOT NULL` : `title_badge`, `taglines`, `intro`, `mission`, `current_activity`, `seeking_format`,
   `seeking_location`, `seeking_availability`, `cv_path`.
2. Contraintes : `<> ''` sur les huit colonnes `text` ; `taglines` : `cardinality(taglines) >= 1`, sans élément vide
   ni nul (même motif que `paragraphs` de `0014`).
3. Supprimer `headline`, `bio`, `availability`.
4. Schéma Drizzle `profile.ts` : retirer les trois colonnes, ajouter `.notNull()` aux neuf nouvelles.
5. Seed `0001_profile.sql` : retirer les trois colonnes des deux insertions (`values` et `on conflict`) ;
   `docs/traductions-a-relire.md` : retirer les lignes `headline`, `bio`, `availability` du profil.
6. Aucune table à supprimer. `experience_skills.shown_in_stack` et `skills.main_stack_order` sont déjà dans leur
   état final (non nul, resp. nullable par conception).
7. Tests qui dépendront des anciennes colonnes et à adapter (autorisation à reconduire) :
   `test/db/schema-constraints.e2e-spec.ts` (« refuse une locale hors fr/en… » insère un profil avec
   `headline, bio, availability` ; le nom du test et le `rejects.toThrow(/locale_code_check/)` restent valides avec
   les nouvelles colonnes) ; `test/db/front-profile.e2e-spec.ts` (mon test de BF-1 : le premier cas vérifie que les
   anciennes colonnes existent encore, il devra changer pour vérifier leur absence et le `not null`) ; les tests
   unitaires de contrats et d'API qui construisent un `Profile` (étape 2).

## Points ouverts

1. **Liens cachés servis tels quels** : tant que l'étape 2 n'a pas ajouté `shownInStack` au contrat, `GET /experiences`
   et `GET /cv` renvoient aussi les 8 liens `shown_in_stack = false` comme des puces (ex. nopillo : `ocr`,
   `agentic-development` après `docker`). Aucun consommateur réel (le contrat 1.0.0 n'est pas consommé) ; l'étape 2
   règle la question. Contrat attendu (BF-2) : `shownInStack: boolean` sur chaque compétence d'expérience.
2. **Contrat et nullabilité** (à transmettre à dev-contrats) : `recommendations[].locale` (BF-4) vient de la langue
   de la ligne servie, pas d'une colonne ; `aiOverview` n'a pas de `published` : la section est servie tant que
   `deleted_at is null` et qu'une traduction `fr` existe ; `skills.mainStackOrder` est `number | null`
   (colonne `smallint null`) ; `recommendedOn` est une `date` SQL (chaîne `YYYY-MM-DD`, `mode: 'string'` dans Drizzle).
   Aucune colonne dont la nullabilité impose un changement de contrat au-delà du brief.
3. **Rang de la stack principale et index unique** : l'index unique partiel n'est pas différable. Un seed qui
   permuterait deux rangs (ex. 1 et 2) dans une même exécution provoquerait une violation transitoire. Sans effet
   aujourd'hui (rangs stables) ; si on réordonne un jour, passer par deux déploiements ou une instruction de mise à
   null dédiée.
4. **Handoff : `linkedin` du seed vs du handoff** : le seed garde `https://www.linkedin.com/in/julien-lachaux`
   (le handoff écrit `https://linkedin.com/in/julien-lachaux`, même profil). Non modifié, hors BF-6.
5. **Données de tiers** : les trois recommandations nomment leurs auteurs (nom, fonction) comme le handoff et
   LinkedIn ; aucune coordonnée.
