# Brief back-001 : évolutions de l'API pour le front V3

Demandeur : session front, 19 novembre 2026. Validé par Julien le même jour.
Destinataire : session back (orchestrateur du back-end et ses agents dev-sql, dev-contrats, dev-api,
qa, chef-de-projet).

Contexte : le design v6 du site est figé (copie de travail hors dépôt :
`/home/jlachaux/IA_PROJECTS/site-perso/front-handoff-v6/`, lire `SPEC.md` et
`data/site-content.json`). Le mapping validé champ par champ est dans `docs/04-front-donnees.md`.
Ce brief liste ce que le back doit ajouter ou changer. Il ne touche ni `apps/web` ni le front.

Règles inchangées : SQL manuel source de vérité, seeds idempotents, soft delete, repli par ligne,
contrat OpenAPI 3.2.0, couverture 100 %, mutation, traductions EN marquées « à relire » et listées
dans `docs/traductions-a-relire.md`.

## Ordre demandé : le contrat d'abord

1. **Lot contrats (bloquant pour le front)** : les schémas Zod et le document OpenAPI de BF-1 à BF-7,
   fusionnés dans `develop` le plus tôt possible, même avant les migrations. Le front s'en sert pour
   ses fixtures et ses types.
2. **Lot SQL + API** : migrations, seeds, dépôts, routes, e2e. Le front bascule sur l'API réelle
   quand il est fusionné.

Chaque commit cite son ticket (`feat(contracts): … (BF-1)`) : c'est ainsi que la session front suit
l'avancement (`git log develop --grep BF-`).

## Tickets

### BF-1 Profil restructuré
- `profile_translations` : ajouter `title_badge`, `taglines text[]`, `intro`, `mission`,
  `current_activity`, `seeking_format`, `seeking_location`, `seeking_availability`, `cv_path` ;
  supprimer `headline`, `bio`, `availability` (le contrat 1.0.0 n'est pas encore consommé).
- Contrat `Profile` (et `Cv.profile`) : `titleBadge`, `taglines: string[]` (1 min), `intro`,
  `mission`, `currentActivity`, `seekingFormat`, `seekingLocation`, `seekingAvailability`,
  `cvPath` ; plus de `headline`, `bio`, `availability`. Champs non vides.
- Seed FR (textes du handoff, `profile.*`) :
  - `title` « Développeur full-stack », `title_badge` « senior » ;
  - `taglines` = les 2 lignes de `profile.taglines` ;
  - `intro`, `mission`, `current_activity` = `profile.intro`, `profile.mission`, `profile.currently` ;
  - `seeking_*` = `profile.lookingFor.format`, `.location`, `.availability` ;
  - `cv_path` = `/cv/cv-fr.pdf` (EN : `/cv/cv-en.pdf`).
- Seed EN : traductions « à relire ».
- `first_name`, `last_name`, `location`, `picture_path` : inchangés.

### BF-2 Liens expérience ↔ compétence cachés
- `experience_skills.shown_in_stack boolean not null default true`.
- Contrat : chaque compétence d'une expérience porte `shownInStack: boolean`.
- Seed : liens supplémentaires en `shown_in_stack = false` (issus des `searchKeywords`) :
  `nopillo` → `ocr`, `agentic-development` ; `contentsquare` → `google-analytics`,
  `adobe-analytics`, `production-operations` ; `wynd-integration` → `rest-api`,
  `production-operations` ; `afluens` → `rest-api`.

### BF-3 Compétences : noms courts et stack principale
- `skills.main_stack_order smallint null` (unique quand non nul, > 0). Contrat :
  `mainStackOrder: number | null`.
- Seed : `typescript` 1, `nodejs` 2, `nestjs` 3, `vuejs` 4, `postgresql` 5, `kafka` 6, `docker` 7.
- Renommages FR (EN à relire) : `managed-cloud-deployment` → « Cloud managé » ;
  `production-operations` → « Diagnostic en production ». Les autres noms restent.
- Inventaire inchangé (les seeds font foi, `php` et `symfony` restent séparés).

### BF-4 Recommandations (nouvelle ressource)
- Tables `recommendations` (`id`, `slug`, `author_name`, `recommended_on date`, `sort_order`,
  `published`, `deleted_at`) et `recommendations_translations` (`author_role`, `relationship`,
  `paragraphs text[]` non vide).
- Route `GET /recommendations` et clé `recommendations` dans `GET /cv`, ordre `sort_order`.
- Contrat : `slug`, `authorName`, `authorRole`, `relationship`, `recommendedOn` (date ISO),
  `paragraphs: string[]`, **`locale`** = langue de la ligne réellement servie (`fr` en repli) : le
  front en a besoin pour poser `lang` sur la citation.
- Seed : les 3 entrées de `recommendations` du handoff, **FR seulement** (citations non traduites),
  textes repris à l'identique (coquilles comprises), `relationship` « Responsable direct de Julien »,
  dates 2025-12-08, 2020-11-04, 2020-09-25. **`published = false`** tant que les auteurs n'ont pas
  donné leur accord (Julien basculera).

### BF-5 Section IA (nouvelle ressource, une ligne)
- Tables `ai_overview` (`id = 1`, `deleted_at`), `ai_overview_translations` (`title`,
  `in_product_label`, `in_product_items text[]`, `daily_label`, `daily_text`), `ai_overview_skills`
  (`skill_id`, `sort_order`).
- Route `GET /ai-overview` et clé `aiOverview` dans `GET /cv`.
- Seed FR depuis `ai.*` du handoff (pas le champ `todo`) ; tags : `mastra`, `agentic-development` ;
  EN à relire.

### BF-6 Lien des recommandations LinkedIn
- `social_links` : slug `linkedin-recommendations`, kind `linkedin`, URL
  `profile.links.linkedinRecommendations` du handoff, libellés FR/EN.

### BF-7 OpenAPI
- Routes et schémas nommés de BF-1 à BF-6 dans `packages/contracts/src/openapi/document.ts` ;
  `cv.fixtures.ts` à jour.

## Hors périmètre (ne pas faire)
Pas d'endpoint de contact, pas de formulaire, pas de champ e-mail : le front fait un `mailto:`.
Pas de changement sur `projects`, `tools`, `resources`, `certifications`, `education`, `languages`.

## À venir (sera demandé par un brief ultérieur)
Build et service du front dans la pile Docker et Caddy (le front génère ses pages au build à partir
de `GET /cv`) : besoins précisés quand le front sera prêt à être déployé.

## Questions
Toute question ou désaccord sur ce brief : à Julien, qui tranche. Une réponse technique (nom de
champ différent, contrainte SQL) se note dans le compte rendu du lot avec le numéro BF.
