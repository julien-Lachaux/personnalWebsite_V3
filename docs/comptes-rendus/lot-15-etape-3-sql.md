# Lot 15, étape 3 : profil à son état final (dev-sql)

Branche `lot/15-brief-back-001`, ticket BF-1. Isolation Docker `siteperso-v3-lot15`. Commit
`feat(db): profil à son état final…` (porte `Justification-test: BF-1`).

## Fait

- `db/migrations/0016_profile_front_final.sql` : `not null` sur les neuf colonnes ; `<> ''` sur les huit colonnes
  texte (contraintes nommées `profile_translations_<colonne>_check`) ; `taglines` : `cardinality >= 1`, sans élément
  vide ni nul (`profile_translations_taglines_check`, même motif que `paragraphs` de 0014) ; suppression de
  `headline`, `bio`, `availability`.
- Schéma Drizzle `profile.ts` aligné (trois colonnes retirées, `.notNull()` sur les neuf).
- Seed `0001_profile.sql` sans les anciennes colonnes (`values` et `on conflict`) ; `docs/traductions-a-relire.md`
  sans les lignes `headline`, `bio`, `availability` du profil.
- Dépôt du profil : `present()`, `isComplete`, `FRONT_TEXT_COLUMNS` et la condition de complétude des jointures
  supprimés ; les jointures `fr` et `en` sont redevenues celles d'avant BF-1.
- `pnpm db:reset` OK ; `pnpm check` vert (unitaires 430, couverture 100 % : instructions 765/765, branches 232/232,
  fonctions 276/276, lignes 745/745) ; `pnpm integrity develop` OK ; `pnpm db:down` fait ; aucun `.stryker-tmp*`.

## Tests modifiés (autorisation af932f7f, BF-1)

| Fichier | Test | Avant | Après |
| --- | --- | --- | --- |
| `src/infrastructure/db/profile/drizzle-profile.repository.spec.ts` | « n'accepte, dans la jointure %s, qu'une ligne aux colonnes du design v6 non vides » (x2) | vérifiait la condition de complétude dans le SQL | supprimé (la condition n'existe plus, la base garantit) ; helper `paramAfter` et `TEXT_COLUMNS` retirés ; `describe` renommé ; libellé « (absente ou supprimée) » |
| `test/db/front-profile.e2e-spec.ts` | « ajoute les neuf colonnes… et garde les anciennes » | anciennes colonnes de type `text` | « porte les neuf colonnes… not null, sans les anciennes » : `is_nullable = NO` et absence de `headline`, `bio`, `availability` |
| idem | « refuse une traduction en dont une nouvelle colonne est nulle (complétude) » et « …taglines est un tableau vide » (message `Traduction en incomplète`) | un `update` dans un seed produisait une ligne incomplète | remplacés par : refus du null par colonne (9), du vide par colonne (8), de `taglines` vide / élément vide / élément nul (3), acceptation d'une seule accroche, seed qui vide une colonne refusé par la base |
| `test/db/schema-constraints.e2e-spec.ts` | « refuse une locale hors fr/en… » | insertion avec `headline, bio, availability` | insertion avec les neuf nouvelles colonnes ; assertion `locale_code_check` inchangée |
| `test/profile-front.e2e-spec.ts` | bloc « ligne en incomplète » (8 cas) | `update` préparant une ligne `en` incomplète, repli sur `fr` | bloc « la base refuse toute valeur vide ou nulle » : null par colonne et par langue (18, profil inchangé), vide (16), `taglines` (3), plus « sans ligne en, la ligne fr est servie entière » |
| idem | bloc « ligne fr incomplète… (404) » (3 cas) | `update` préparant une ligne `fr` incomplète | « sans ligne fr » (suppression de la ligne) : 404 en fr, en en et pour `/cv` ; le cas `deleted_at` est conservé tel quel |

Chaque contrainte a un test qui la viole : neuf `not null`, huit `check` texte, `taglines` (3 formes), par langue au
niveau API.

## Mutation

- Contrats : 100 % (seuil 100).
- API : 42,53 % au premier passage, 42,03 % au second (seuil 40), sous la référence 46,37 % de l'étape 2.
  Analyse : `drizzle-profile.repository.ts` n'a plus de mutant évaluable (15 erreurs de compilation, 0 survivant,
  0 sans couverture) ; les survivants de `schema/profile.ts` (21) sont les noms de tables et de colonnes, réserve
  connue (motif 1 de `stryker.config.mjs`), et il en a trois de moins qu'avant (trois colonnes retirées). La baisse
  vient de deux causes que je n'ai pas pu séparer : les mutants tués de la condition de complétude ont disparu avec
  le code, et le partage tué/timeout/survivant des noms de colonnes d'autres schémas (fichiers non touchés :
  `education.ts`, `projects.ts`…) varie d'un passage à l'autre (399 tués, 25 timeouts, 199 survivants au premier ;
  20 timeouts et 204 survivants au second). Aucun survivant nouveau dans le code touché : rien à tuer par un test.

## Décisions

- Un seed écrivant une valeur vide est maintenant refusé par la base (contrainte nommée), plus par le contrôle
  `assertEnglishTranslations`, qui reste utilisé par les autres entités (couverture 100 %).
- Contraintes nommées explicitement pour que les tests ciblent le nom de la contrainte.

## Non fait / hors périmètre

`docs/01-modele-de-donnees.md` et `packages/contracts/README.md` (orchestrateur). Contrat Zod inchangé.

## Points ouverts

1. Score de mutation de l'API sous la référence de l'étape 2 (voir analyse) : si l'orchestrateur veut une mesure
   propre, comparer avec un passage sur `develop` dans les mêmes conditions de charge.
2. Les traductions EN du profil restantes (title, picture_alt, accroches, intro, mission, etc.) sont toujours à relire.
