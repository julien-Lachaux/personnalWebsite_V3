# Lot F7 : pages annexes, version anglaise complète, SEO (lead-architecte)

Date : 21 novembre 2026. Branche `lot/F7-annexes` (worktree `.claude/worktrees/lot-F7-annexes`), depuis
`develop` (44bf925). Isolation : `.env` racine `siteperso-v3-f7`, 5972/5973, `PLAYWRIGHT_PORT=5974`,
`WEB_E2E_PORT=5975`. Aucune configuration protégée touchée, aucun test existant modifié. Rien dans
`apps/api`, `db`, `packages/contracts`. Fichiers du lot F6 non touchés. Journaux : dossier temporaire
de session, préfixe `f7-`. Règle D26 : vérifications ciblées seulement.

## Résumé : tout est écrit et vérifié, RIEN N'EST COMMITTÉ (sortie honorable)

Après la pause demandée par l'orchestrateur, les garde-fous ont classé comme « tests existants » les
fichiers de test **créés pendant ce lot** (non suivis) et refusent toute retouche (Edit, Write, shell :
« modification d'un test existant … Aucune autorisation « tests » »). Cinq de ces nouveaux fichiers ont
des défauts (lint, typecheck, 3 assertions) ; avec eux, le hook pre-commit (`turbo run lint typecheck
test`) refuse tout commit. Je n'ai rien contourné. Le correctif est prêt :
**`docs/comptes-rendus/lot-F7-tests.patch`** (`git apply --check` OK), à appliquer sous autorisation
« tests » (Justification-test : `F7 tests créés par le lot`), puis committer le lot.

## Fait (dans l'arbre de travail)

| Ticket | Livré |
|---|---|
| F7-01 déclaration | `pages/accessibilite.vue` : `/accessibilite` et `/en/accessibility` (`i18n.customRoutes: 'config'`, `i18n.pages`). Rubriques du modèle RGAA (accessibilite.numerique.gouv.fr) : mention « Version provisoire », engagement, état **non conforme** (règle du RGAA sans audit valide, aucun taux), référentiel WCAG 2.2 AA / RGAA 4.1.2 ou version en vigueur, technologies, environnement de test (axe, 7 largeurs, thèmes, fr/en ; tests manuels à l'audit), contenus non accessibles (liste `declaration.issues.items`, vide documentée), contact `mailto:` de `NUXT_PUBLIC_CONTACT_EMAIL` (adresse jamais affichée ; absente : la génération échoue), voies de recours (Défenseur des droits : `nous-contacter-355`, `carte-des-delegues`, courrier Libre réponse 71120), date. Texte dans `common.json` fr/en |
| F7-01 404 / erreur | `app/error.vue` (remplace app.vue : refait `lang`, lien d'évitement, `usePreferencesSync`) dans le gabarit `layouts/annex.vue` (lien `>_ julien-lachaux` vers l'accueil, accessibilité, langue, thème) ; 404 « Page introuvable » / « Page not found », autre statut « Une erreur est survenue » + code (500 par défaut), aucun détail technique ; `noindex`, ni canonique ni hreflang. Corps commun `components/annex/AnnexPage.vue` (`<main id="contenu">`, retour à l'accueil, fenêtre `>_ fichier`) |
| Prérendu 404 | `experimental.prerenderErrorPages: [404]` → `/404.html` rendue côté serveur (fr) ; `/en/404.html` prérendue en plus (`domain/error-pages.ts`, hook `prerender:generate` qui garde la seule 404 attendue) ; greffon `plugins/localized-error-page.server.ts` qui retire `payload.path` (sans lui, l'adresse affichée devenait `/en/404.html` après hydratation : constaté au navigateur) |
| F7-02 anglais | `app/i18n-hardcoded.spec.ts` (aucun texte ni nom accessible en dur dans un gabarit ; libellés EN identiques au FR limités à une liste relue) ; `test/pages.e2e.ts` cherche les libellés français dans `/en`, `/en/accessibility`, `/en/404` (texte, noms accessibles, titre, description, hors `lang="fr"`) ; 138 traductions EN d'interface listées pour Julien |
| F7-03 SEO | `composables/seo/useSeo.ts` : `useSiteSeo` (app.vue : description par défaut de la langue, `og:type`, `og:title` = titre de la page par `%s`, `og:description`) et `usePageSeo` (titre, description) ; `og:url`, `og:locale` par `useLocaleHead` ; pas d'`og:image`. `sitemap.xml` et `robots.txt` écrits en fin de prérendu (`nuxt.config.ts`, hook `nitro:init` → `prerender:done`) par `domain/sitemap.ts` à partir des canoniques et hreflang des pages générées (aucune liste de routes) |
| Partagé | `app.vue` : `<NuxtLayout>` + `useSiteSeo()` ; gabarit par `routeRules` `appLayout: 'annex'` ; CLAUDE.md (structure, modules isolés, i18n, référencement) |

## Vérifications

| Critère | Commande | Résultat |
|---|---|---|
| Format | `pnpm format` | code 0 |
| Lint | `pnpm --filter @siteperso/web lint` (`f7-lint2.log`) | code produit propre ; 13 erreurs et 2 avertissements, **tous dans les nouveaux tests verrouillés** (corrigés par le patch) |
| Typecheck | `pnpm --filter @siteperso/web typecheck` | 1 erreur, `error.spec.ts:101` (`get(...).exists`, corrigée par le patch) |
| Unitaires + couverture | `vitest run --coverage --coverage.reportOnFailure --maxWorkers=4` (`f7-coverage4.log`) | 1041 réussis, 4 échecs (ci-dessous) ; **couverture 100 %** : 1264/1264 instructions, 697/697 branches, 417/417 fonctions, 1126/1126 lignes |
| Mutation | `stryker run --mutate app/domain/sitemap.ts,app/domain/error-pages.ts` (`f7-mutation2.log`) | **100 %** (123 tués, 0 survivant) |
| Génération | `pnpm --filter @siteperso/web generate:fixtures` | code 0 : `index`, `en/index`, `accessibilite/`, `en/accessibility/`, `404.html` (lang fr), `en/404.html` (lang en, sans `payload.path`), `200.html`, `fr/…` (redirections), `robots.txt`, `sitemap.xml` (4 URL, hreflang fr/en/x-default) |
| Parcours | `playwright test test/pages.e2e.ts test/smoke.e2e.ts` (`f7-e2e1.log`) puis avec `shell` et `boot` (`f7-e2e2.log`) | pages + smoke 133/133 aux 7 tailles ; avec shell/boot 325 réussis, 4 délais dépassés (`shell.e2e.ts` axe à 390 px, machine chargée par F6), **rejoués verts** 8/8 (`f7-e2e3.log`) |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » (aucun commit) |

Échecs unitaires : 3 dans les nouveaux tests (`error.spec.ts` ×2 : la langue reste `en` d'un test à
l'autre, `beforeEach` sans remise à `fr` ; `i18n-hardcoded.spec.ts` : relève la prop `title` des
composants `BaseWindow`/`Popover` et le `[ok]` de l'easter egg), corrigés par le patch ; 1 test
existant obsolète (ci-dessous).

## Tests existants rendus obsolètes (D23, correcteur)

| Fichier : test | Exige | Faux parce que |
|---|---|---|
| `app/components/home/HomePage.spec.ts` : « relie le CV PDF de la langue et la déclaration d'accessibilité localisée » (l. 134) | `/en/accessibilite` | la page anglaise est `/en/accessibility` (ticket F7-01) ; reçu `/en/accessibility` |

## Pour Caddy (BF-14)

- Statique : `.output/public` ; `/` → `index.html`, `/en` → `en/index.html`, `/accessibilite` →
  `accessibilite/index.html`, `/en/accessibility` → `en/accessibility/index.html` (`try_files {path}
  {path}/index.html`).
- 404 : `handle_errors 404` → sous `/en/*` (et `/en`) réécrire vers `/en/404.html`, sinon `/404.html`,
  `file_server` en gardant le **statut 404**. Ne pas servir `200.html` (coquille SPA vide).
- `/fr` et `/fr/*` : 301 vers le chemin sans préfixe (les pages `fr/…` générées sont des `meta refresh`).
- `robots.txt` (`text/plain`) et `sitemap.xml` (`application/xml`) à la racine, revalidés comme le HTML.
- **`NUXT_PUBLIC_I18N_BASE_URL` = domaine de production au build** : canoniques, hreflang, `og:url`,
  `sitemap.xml` et `robots.txt` en dépendent (défaut `http://localhost:3001`).
- CSP : les pages 404 ont aussi leurs scripts en ligne (`importmap`, `__NUXT__`) à hacher.

## Textes à valider par Julien

Tout `declaration.*` (dont l'engagement à la première personne, la date, la pertinence du Défenseur
des droits pour un site personnel), `seo.description` (cite « Julien Lachaux »), `notFound.*`,
`error.*`, `annex.home` ; 138 traductions EN d'interface listées dans
`docs/front-a-traiter-par-julien.md` (avec image Open Graph et adresse publique du site).

## Décisions

- **Chemin anglais `/en/accessibility`** (ticket) plutôt que `/en/accessibilite` : rend obsolète un test
  de HomePage (ci-dessus). **`i18n.pages` et `routeRules.appLayout` plutôt que `definePageMeta`** : la
  macro laisse dans le composant une branche jamais exécutée par les tests (couverture 87,5 % des
  branches de la page, mesuré).
- **Sitemap déduit des pages générées** plutôt qu'une liste de routes ou `@nuxtjs/sitemap` : aucune
  dépendance, cohérence par construction avec les canoniques et hreflang (vérifiée par le parcours).
- **404 par langue** (deux fichiers) plutôt qu'un seul `404.html` : servi sous `/en`, le français
  basculait en anglais à l'hydratation (« Hydration completed but contains mismatches », constaté).
- `og:locale` reste `fr`/`en` (format `language` des locales) : passer à `fr_FR` changerait aussi
  `hreflang` ; à trancher si Julien le souhaite.

## Points ouverts

1. **Autorisation « tests » et patch** (`lot-F7-tests.patch`) : `useSeo.spec.ts`, `error.spec.ts`,
   `i18n-hardcoded.spec.ts`, `plugins/localized-error-page.spec.ts`, `test/pages.e2e.ts`. Non exécuté
   après correction (le hook refuse aussi un script de vérification hors dépôt qui cite ces chemins) :
   relancer lint, typecheck et unitaires après application, puis committer le lot (et la correction de
   `HomePage.spec.ts` par le correcteur, sinon le pre-commit échoue toujours).
2. Cause du verrouillage : instantané paresseux du worktree pris après la création des fichiers ?
   (hook refusant `python3`, puis Edit, sur des fichiers non suivis créés dans la tâche ; README :
   « un test créé pendant la tâche reste libre »). À examiner côté garde-fous.
3. `.claude/agents/dev-front.md` : ajouter `error.vue`, `layouts/`, `plugins/`, `components/annex/`,
   `composables/seo/` aux fichiers partagés (fichier protégé, hors autorisation).
4. Délais des parcours `shell.e2e.ts` à 390 px (~20 s par test, limite 30 s) sous charge parallèle.
