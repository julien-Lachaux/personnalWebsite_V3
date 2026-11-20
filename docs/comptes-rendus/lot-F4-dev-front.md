# Lot F4 : couche de données du front (dev-front)

Date : 20 novembre 2026. Branche `lot/F4-donnees` (worktree `.claude/worktrees/lot-F4-donnees`), depuis `develop`
(961a2e6). Isolation : `COMPOSE_PROJECT_NAME=siteperso-v3-f4`, ports 5902 à 5905. Périmètre écrit : `apps/web/app/data/`
(sources, mapping, fixtures, tests) et ce compte rendu. Aucun fichier partagé touché.

## Fait

| Ticket | Livré | Fichiers (`apps/web/app/data/`) |
|---|---|---|
| F4-01 | Port `CvSource` (`load(locale): Promise<Cv>`), `CvSourceError` (`config`, `network`, `http`, `invalid`), `ApiCvSource` (`GET {baseUrl}/api/v1/cv?lang=` par `fetch` injecté, `Accept: application/json`, délai 10 s par `AbortSignal.timeout`), `FixtureCvSource`, `parseCv` (schéma `CvSchema` des contrats) | `cv-source.ts`, `api-cv-source.ts`, `fixture-cv-source.ts`, `parse-cv.ts` |
| F4-02 | Fixtures `cv.fr.ts` et `cv.en.ts` validées par `CvSchema` dans `fixtures/cv-fixtures.spec.ts` | `fixtures/` |
| F4-03 | Modèles de vue (`cv-view.ts`) et mapping (`map-cv.ts`) : `mapCv(cv, labels)` et un mapper par section | `cv-view.ts`, `map-cv.ts` |
| F4-04 (data) | `createCvSource(settings, fetch)` (fonction pure) et `fetchCv(deps, locale)` (pont vers `useAsyncData`, sans importer Nuxt) | `select-cv-source.ts`, `fetch-cv.ts` |

Messages d'erreur (tous en français, testés mot pour mot) :

- réseau : `API injoignable (GET http://…/api/v1/cv?lang=fr) : fetch failed (connect ECONNREFUSED 127.0.0.1:3999)`
  (la cause est citée : `fetch` de Node ne dit que « fetch failed ») ; délai dépassé : même forme ;
- HTTP : `L'API a répondu HTTP 503 (GET …) : <detail du problem+json>` ; sans `detail` : statut seul ; corps non JSON :
  `… : corps de réponse non JSON` ;
- réponse : `Réponse non JSON (GET …) : …` ; `Réponse non conforme au contrat Cv (GET …) : experiences.0.kind : …` (jusqu'à
  5 champs fautifs, `chemin : message`, séparés par ` ; `) ; `Langue inattendue (…) : « fr » demandée, « en » reçue` ;
- configuration : `Source du CV inconnue : « mock » (valeurs admises : api, fixtures)`, `URL de base de l'API absente : …`,
  `URL de base de l'API invalide : « ftp://… » (adresse http ou https attendue)`.

### Preuves

- Couverture `pnpm --filter @siteperso/web test:coverage` : 100 % (511/511 instructions, 307/307 branches, 145/145
  fonctions, 454/454 lignes), 438 tests.
- Mutation `pnpm --filter @siteperso/web test:mutation` : 100,00 %, `app/data/` 230 mutants tués, 0 survivant, 0 sans
  couverture, 0 erreur ; aucune directive `Stryker disable`, aucun équivalent déclaré. Premier passage : 2 survivants
  (un `catch` vide équivalent au chemin normal, un `<= 0` dans la coupure du titre) et 4 erreurs d'exécution (calculs au
  niveau d'un `describe`) ; corrigés par la forme du code et des tests (le `catch` renvoie « corps de réponse non JSON », la
  coupure du titre est une expression régulière testée aux bords).
- Lecture réelle : API de dev démarrée sur les seeds (`db:reset`), `createCvSource({ source: 'api', … })` puis `mapCv` :
  `fr` et `en` lus et validés (8 expériences, 34 technos, 3 recommandations, « janv. 2026 – mai 2026 » / « Jan 2026 – May
  2026 »). Sur un port sans API : échec explicite (message réseau ci-dessus), jamais de repli.
- `composables/use-cv.ts` de la notice ci-dessous : typé avec `vue-tsc` (fichier temporaire, retiré).

## API de `app/data/`

Imports avec l'extension `.js`, alias `~/data/...` côté Nuxt.

- `cv-source.ts` : `interface CvSource`, `type FetchFn = typeof fetch`, `class CvSourceError(kind, message, { cause?, status? })`.
- `api-cv-source.ts` : `new ApiCvSource({ baseUrl, fetch, timeoutMs? })` (`baseUrl` validée à la construction : http ou https,
  barres finales retirées, préfixe de chemin conservé), `DEFAULT_TIMEOUT_MS`.
- `fixture-cv-source.ts` : `new FixtureCvSource()` (copie revalidée par le contrat à chaque lecture).
- `select-cv-source.ts` : `createCvSource({ source, apiBaseUrl }, fetch)` : `source` vide ou absente = `api` (défaut volontaire :
  un build de production sans configuration échoue au lieu d'embarquer des fixtures) ; `api` exige `apiBaseUrl`.
- `fetch-cv.ts` : `fetchCv(deps, locale): Promise<Cv>`, `cvAsyncDataKey(locale)` (`cv-fr`, `cv-en`), `FetchCvDeps`.
- `cv-view.ts` : `CvView { locale, profile, links, experiences, techs, recommendations, ai }` et ses sous-types, `CvLabels`.
- `map-cv.ts` : `mapCv(cv, labels): CvView`, `mapProfile`, `mapLinks`, `mapExperiences(experiences, locale, labels)`,
  `mapTechs`, `mapRecommendations`, `mapAi`.

Modèles de vue (types dans `cv-view.ts`) :

| Section | Modèle | Règles |
|---|---|---|
| Profil | `ProfileView` : `title`, `titleLines` (premier mot / reste), `badge`, `taglines`, `intro`, `mission`, `currently`, `lookingFor { format, location, availability }`, `cvPath` | `title` « Développeur full-stack » devient « Développeur » / « full-stack » ; un titre d'un mot reste sur une ligne |
| Liens | `LinksView { linkedin, github, linkedinRecommendations }`, chacun `{ url, label } \| null` | par slug ; **GitHub absent : `null`, le bouton est masqué** ; `label` servi par l'API dans la langue |
| Expériences | `ExperienceView extends FilterExperience` : `kind`, `title`, `organisation`, `prefix` (`@` ou `›`), `period`, `meta`, `summary`, `achievements`, `stack`, `visibleSlugs`, `hiddenSlugs` | période par `formatPeriod` (`dateEnd` nul : libellé `present` injecté) ; `meta` par `formatExperienceMeta` (`none` omis, vide si rien) ; `kind = break` : organisation = libellé injecté, préfixe `›`, `stack` = la seule puce `{ slug: null, label: stackLabel, easterEgg: true }` ; sinon `stack` = compétences `shownInStack` dans l'ordre ; `visibleSlugs`/`hiddenSlugs` = compétences `shownInStack` vraies/fausses |
| Technos | `TechsView { groups, all, total, mainStack }` | `FilterTech { slug, name, groupSlug, mainStackOrder }` ; `total` = N de « Toutes les technos (N) » ; `mainStack` par `domain/filter.mainStack` (rang) |
| Recos | `RecommendationView { slug, author, role, context, paragraphs, lang }` | `context` = `relationship · date` ; **liste vide si aucune recommandation publiée** ; `lang` = `locale` de la ligne servie |
| IA | `AiView \| null` : `title`, `inProduct { label, items }`, `daily { label, text }`, `tags [{ slug, name }]` | `null` si l'API ne sert pas la section |

Libellés injectés (`CvLabels`) : `present`, `breakOrganisation`, `workMode(valeur)`, `contractType(valeur)`. Aucune chaîne
d'interface dans `data/`.

## Notice d'intégration pour le lead (F3a / F5)

1. **`nuxt.config.ts`** : deux clés **privées** de `runtimeConfig` (lues au prérendu côté serveur, absentes de la charge utile
   envoyée au navigateur) :

   ```ts
   runtimeConfig: {
     cvSource: '', // NUXT_CV_SOURCE : « api » (défaut) ou « fixtures »
     apiBaseUrl: '', // NUXT_API_BASE_URL : ex. http://localhost:3000 (sans /api/v1)
     public: { contactEmail: '' },
   },
   ```

   `apps/web/.env.example` : ajouter `NUXT_CV_SOURCE=api` et `NUXT_API_BASE_URL=http://localhost:3000`. Le parcours Playwright
   (`test:e2e` = `nuxt generate && playwright test`) n'a pas d'API : y poser `NUXT_CV_SOURCE=fixtures` (script `test:e2e` ou
   environnement du `webServer`), sinon la génération échoue, comme voulu.

2. **`app/composables/use-cv.ts`** (partagé, trois lignes utiles ; typé et vérifié) :

   ```ts
   import type { Locale } from '@siteperso/contracts';
   import { fetchCv } from '~/data/fetch-cv';

   export function useCv(locale: Locale) {
     const config = useRuntimeConfig();
     return fetchCv(
       {
         asyncData: (key, handler) => useAsyncData(key, handler),
         settings: () => ({ source: config.cvSource, apiBaseUrl: config.apiBaseUrl }),
         fetch: globalThis.fetch,
       },
       locale,
     );
   }
   ```

   Pourquoi par injection : `app/data/` est testé sans Nuxt (projet `unit`, un auto-import y échoue) ; le fichier ci-dessus
   est le seul à connaître `useAsyncData`. La source est créée **dans** le gestionnaire : dans le navigateur la donnée vient de
   la charge utile et la configuration privée n'est jamais lue. `fetchCv` relève l'erreur que `useAsyncData` range dans
   `error` : l'API qui ne répond pas fait échouer la génération (`nitro.prerender.failOnError: true` déjà posé) au lieu de
   produire des pages vides. **Non vérifié de bout en bout** (aucune page ne l'appelle dans ce lot) : à contrôler en F3a/F5,
   `NUXT_API_BASE_URL` sur un port mort doit faire échouer `nuxt generate`.

3. **Page** (F3a/F5) :

   ```ts
   const { locale, t } = useI18n();
   const cv = await useCv(locale.value as Locale);
   const view = computed(() => mapCv(cv, {
     present: t('experience.present'),
     breakOrganisation: t('experience.breakOrganisation'),
     workMode: (value) => t(`experience.workMode.${value}`),
     contractType: (value) => t(`experience.contractType.${value}`),
   }));
   ```

   Les clés i18n sont celles de l'agent de la section expériences (`i18n/locales/{fr,en}/experience.json`). Les sections
   reçoivent leur morceau de `view` (props), jamais le contrat. La charge utile est le `Cv` brut (JSON sérialisable) ; le
   mapping se refait côté client à l'hydratation (pur et rapide).

4. **Mailto** : hors `data/` (`useRuntimeConfig().public.contactEmail`, libellés i18n), non traité ici.

## Écarts entre le contrat livré et `docs/04` (à signaler, pas contournés)

1. **OpenClassrooms : « À distance, à distance »**. Le seed donne `location = 'À distance'` (`Remote` en en) **et**
   `workMode = remote` ; la ligne `lieu, mode · contrat` de `docs/04` produit « À distance, à distance » (« Remote, remote »),
   alors que le handoff affiche « Remote ». Le mapping applique `docs/04` à la lettre. Correction possible côté back (seed :
   `location` nul pour cette expérience, avec `workMode` seul) ou règle du front ; à décider (brief back si seed).
2. **`stackLabel` est servi pour toutes les expériences** (liste des technos séparées par des virgules : « TypeScript, Elysia.js,
   … »), pas seulement pour la pause comme le suppose `docs/04`. Le front ne s'en sert que pour `kind = break` ; sans effet
   visible, mais le champ est redondant avec `skills` pour les autres.
3. **Recommandations `published = true`** dans le seed `0006` (décision de Julien du 19 nov. : déjà publiques sur LinkedIn),
   contrairement au `published = false` du brief et de la consigne du lot. L'API les sert donc ; la fixture aussi. Si l'état
   vide doit être exercé, il se teste avec `recommendations: []` (le mapping le couvre).
4. **Technos : 34** (docs/04 le prévoit : toutes les compétences publiées, pas les 25 du design) ; sept groupes dont les noms
   sont ceux des seeds (« Langages et frameworks », …) ; les noms viennent de `skill.name` (« Vue.js (2 et 3) », comme le handoff).
5. Conforme au contrat livré, sans écart : `profile.*` (champs `title`, `titleBadge`, `taglines`, `intro`, `mission`,
   `currentActivity`, `seeking*`, `cvPath`), `socialLinks` (`linkedin`, `linkedin-recommendations`), `skills.mainStackOrder`,
   `experiences[].skills[].shownInStack`, `recommendations[].locale`, `aiOverview` (`null` possible).

## Décisions

- **Fixtures tirées de l'API, pas recopiées du handoff** : réponse réelle de `GET /cv` sur les seeds (slugs, noms courts, EN
  des seeds « à relire »), puis assainie : prénom, nom, lieu, texte alternatif du portrait et URLs LinkedIn du profil remplacés
  par des placeholders (`Prénom`, `Nom`, `https://www.linkedin.com/in/example`) ; `projects`, `tools`, `resources`,
  `certifications`, `education`, `languages` vides (le design ne les affiche pas). Le contenu professionnel (accroches,
  expériences, recommandations) est celui du handoff et des seeds. Pas de GitHub dans la fixture : le cas « bouton masqué » est
  celui de la production tant que l'URL manque (P1). Fixtures en TypeScript typé `Cv` (`fixtures/`, exclues de la mutation par
  la configuration existante) et non en JSON, pour que le typage et le test cassent ensemble si le contrat change.
- **Recommandations en `en`** : citations françaises avec `locale: 'fr'` (repli de ligne de l'API). La date de la ligne de
  contexte suit `locale` de la recommandation (« Responsable direct de Julien · 8 décembre 2025 » même sur `/en`) pour que la
  ligne reste d'une seule langue ; `lang` s'applique à toute la carte (rôle, relation, date, citation), pas seulement au
  `blockquote`. À confirmer en F5.
- **Préfixe `@` / `›`** : symbole déduit de `kind` dans le mapping (pas une chaîne de langue), au lieu d'un libellé injecté ;
  seule l'organisation de la pause (« Projet personnel ») est injectée.
- **`titleLines`** : coupure après le premier mot, calculée dans `data/` (une expression régulière) ; le composant peut aussi
  n'utiliser que `title` si la mise en page change.
- **Source par défaut `api`** et échec si l'URL manque : on ne retombe jamais silencieusement sur les fixtures.
- **Configuration privée** (`NUXT_CV_SOURCE`, `NUXT_API_BASE_URL`) et non `NUXT_PUBLIC_*` : rien de cela n'a de raison d'être
  dans la charge utile du site statique.
- **Délai de 10 s** par lecture, pour qu'une API qui ne répond pas ne suspende pas le build.
- **`useCv` hors de `data/`** : `data/` reste testable sans Nuxt ; la jointure `useAsyncData` est un fichier partagé du lead.

## Non fait

- Le branchement au build (`nuxt.config.ts`, `app/composables/use-cv.ts`, pages) et le contrôle « API morte = génération
  en échec » : décrits ci-dessus, hors périmètre.
- Aucun test de `useCv` lui-même (fichier du lead) ; `fetchCv` est testé avec une doublure fidèle à Nuxt (erreur rangée dans
  `error`, donnée vide, charge utile déjà présente sans lecture de la configuration).
- `logo`, `companyUrl` des expériences et les sections `projects`, `tools`, `resources`, `certifications`, `education`,
  `languages` : non affichés par le design v6, donc non mappés.

## Points ouverts

- Écart 1 ci-dessus (« À distance, à distance ») : décision du lead ou brief back (seed).
- Écart 2 (`stackLabel` redondant) : à garder tel quel ou à nettoyer côté back.
- Libellés i18n à créer par l'agent des expériences : `present`, `breakOrganisation`, `workMode.{onsite,hybrid,remote}`,
  `contractType.{cdi,freelance}` (`none` n'est jamais demandé).
- Fixtures : l'image du portrait (`/images/profile/portrait.jpg`) et les logos (`/images/logos/*.svg`) cités par l'API ne
  sont pas servis par `public/` ; le design v6 n'en affiche pas, à vérifier en F3a.
- Demande de changement partagé : `nuxt.config.ts` (deux clés privées), `.env.example`, `app/composables/use-cv.ts`,
  `test:e2e` avec `NUXT_CV_SOURCE=fixtures` (voir la notice).
