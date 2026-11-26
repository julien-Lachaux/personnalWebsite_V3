# Lot 35 : page « panne du serveur » (lead-architecte, ticket L35-3)

Date : 26 novembre 2026. Branche `lot/35-panne-api` (worktree `personnalWebsite_V3-lot35`), isolation du
`.env` racine fourni (`TEST_MAX_WORKERS=2`). Décision appliquée : D48 (`docs/05-front-organisation.md`).
**Rien n'est commité** (consigne de l'orchestrateur) : le pre-commit rejoue les tests de composants, et
trois tests existants de `app/error-server.spec.ts` échouent sur les anciens textes (liste plus bas, à
mettre à jour par le correcteur sous `Justification-test: L35-TESTS`). Aucun test existant modifié, aucune
configuration protégée touchée, aucune commande podman, docker ou compose lancée, Playwright non lancé.

## Fait

Refonte en place de la page d'erreur serveur du lot 30 (`/50x.html`, `/en/50x.html`), même mécanisme
(prérendu par `error.vue`, application retirée par `nuxt.config.ts` et `domain/server-error-page.ts`,
CSP stricte, aucun appel à l'API) : ni `nuxt.config.ts` ni `app/domain/` ne changent.

| Fichier | État | Changement |
|---|---|---|
| `apps/web/app/error.vue` | modifié | branche `serverError` : second paragraphe `serverError.next` ; « Réessayer » rendu par `LinkButton` (`variant="solid"`, `size="lg"`, icône de rechargement décorative, classe `error-page__retry` gardée), toujours un lien `href=""` (recharge l'adresse servie, sans script) dans `.error-page__actions` ; 56 px sur mobile et tablette comme les boutons de la page travaux (D17) ; fenêtre `panne-serveur.log` ; commentaire d'en-tête mis à jour (D48) |
| `apps/web/i18n/locales/fr/common.json` | modifié | `serverError.title`, `serverError.text`, nouvelle clé `serverError.next` |
| `apps/web/i18n/locales/en/common.json` | modifié | mêmes clés, en anglais |
| `apps/web/app/error-outage.spec.ts` | créé | 11 tests de composant (voir ci-dessous) |
| `apps/web/test/server-outage.e2e.ts` | créé | parcours Playwright, **non exécuté** (Podman indisponible) |
| `docs/comptes-rendus/lot-35-lead.md` | créé | ce compte rendu |

`error-outage.spec.ts` : fr et en (titre unique, deux paragraphes exacts, barre `>_ panne-serveur.log`,
titre du document, `lang`, `noindex`) ; « Réessayer » / « Try again » : vrai `<a>`, `href=""`, classes
`base-button`, `base-button--solid`, `base-button--lg`, ni `target`, ni `rel`, ni `onclick`, icône
`aria-hidden` non focalisable, nom = libellé seul, ordre des liens (retour puis réessayer) ; même page pour
404, 500, 502, 503 et 504 sans code (`404`, `50x`, `50\d`) ni détail technique de l'erreur ; page anglaise
sans libellé français ; hors `/50x.html`, 404 et 500 gardent leur page et leur fenêtre sans bouton.

`server-outage.e2e.ts` (complète `server-error.e2e.ts`, à chaque taille d'écran, clair et sombre) : sans
JavaScript, bouton aux couleurs `--accent` / `--on` du schéma et sans soulignement (preuve que la feuille
de style de `LinkButton` est servie avec la page autonome), hauteur ≥ 44 px sous 1024 px, aucun mot coupé
en fin de ligne dans le titre, les paragraphes et le bouton (mesure caractère par caractère par
`Range.getClientRects`), aucun texte hors de la fenêtre ni débordement de page ; avec JavaScript, le
bouton est atteint au clavier, focus visible (`outline` plein), axe WCAG 2.2 AA sans violation.

## Textes proposés (à valider par Julien)

| Clé | fr | en |
|---|---|---|
| `serverError.title` (h1 et titre du document) | Le serveur est en panne pour l’instant | The server is temporarily down |
| `serverError.text` | Le site ne peut pas s’afficher pour le moment. Le problème vient du serveur, pas de votre appareil ni de votre connexion, et il est temporaire. | The site can’t be displayed right now. The problem is on the server’s side, not with your device or your connection, and it’s temporary. |
| `serverError.next` (nouvelle) | Rien n’est perdu : réessayez dans quelques instants, ou revenez un peu plus tard. | Nothing is lost: please try again in a few moments, or come back a little later. |
| `serverError.retry` (inchangé) | Réessayer | Try again |
| `serverError.back` (inchangé) | Retour à l’accueil | Back to the home page |
| nom de fenêtre (ne se traduit pas) | `panne-serveur.log` | `panne-serveur.log` |

- Titre français sans « momentanément » : au lot 30, ce mot de 13 lettres était coupé en plein mot à
  390 px (titre à 2,5 rem, environ 306 px de largeur utile) ; le mot le plus long du titre retenu est
  « l’instant », déjà affiché sans coupure au lot 30. Titre anglais : « temporarily » figurait déjà dans
  le titre du lot 30. La preuve à 390 px est le parcours `server-outage.e2e.ts`, à exécuter.
- Formulation neutre (« le problème vient du serveur ») plutôt que « de notre côté » : le site parle à la
  première personne ailleurs (page travaux) ; « pas de votre appareil ni de votre connexion » dit au
  visiteur que ce n'est pas de son fait, ce qui est exact (la page lui parvient).

## Tests existants devenus obsolètes (pour le correcteur, D23, `Justification-test: L35-TESTS`)

`apps/web/app/error-server.spec.ts` (3 tests en échec) :

| Ligne | Test | Assertion actuelle → nouvelle valeur |
|---|---|---|
| 69-71 | « en français à /50x.html : message, réessayer, retour à l’accueil, sans code ni détail » | h1 `['Site indisponible pour l’instant']` → `['Le serveur est en panne pour l’instant']` |
| 74 | idem | `toContain('Le serveur n’a pas pu répondre à votre demande.')` → `toContain('Le site ne peut pas s’afficher pour le moment.')` |
| 75 | idem | `'>_ erreur-50x.log'` → `'>_ panne-serveur.log'` |
| 83 | idem | `document.title` `'Site indisponible pour l’instant'` → `'Le serveur est en panne pour l’instant'` |
| 95 | « en anglais à /en/50x.html » | h1 `'Website temporarily unavailable'` → `'The server is temporarily down'` |
| 96 | idem | `toContain('The server could not answer your request.')` → `toContain('The site can’t be displayed right now.')` |
| 106 | idem | `document.title` `'Website temporarily unavailable'` → `'The server is temporarily down'` |
| 124 | « ne dépend pas du statut de l’erreur : même page pour un 503 » | h1 `'Site indisponible pour l’instant'` → `'Le serveur est en panne pour l’instant'` |

Restent vraies sans changement : l. 76-79 et 100-105 (liens `[retour, '/']`, `[réessayer, '']`, vérifié par
`error-outage.spec.ts`), l. 56 et 134 (`.error-page__retry` absent hors page serveur : la classe est
gardée sur le bouton).

`apps/web/test/server-error.e2e.ts` (parcours, non exécuté ici ; échoueront sur les textes) :

| Ligne | Élément | Valeur actuelle → nouvelle valeur |
|---|---|---|
| 29, 41 | `PAGES[0].title`, `PAGES[1].title` (fr) | `'Site indisponible pour l’instant'` → `'Le serveur est en panne pour l’instant'` |
| 30, 42 | `PAGES[0].text`, `PAGES[1].text` (fr) | `'Le serveur n’a pas pu répondre à votre demande.'` → `'Le site ne peut pas s’afficher pour le moment.'` |
| 53, 65 | `PAGES[2].title`, `PAGES[3].title` (en) | `'Website temporarily unavailable'` → `'The server is temporarily down'` |
| 54, 66 | `PAGES[2].text`, `PAGES[3].text` (en) | `'The server could not answer your request.'` → `'The site can’t be displayed right now.'` |
| 123 | `expectServerErrorPage` | `toContainText('>_ erreur-50x.log')` → `toContainText('>_ panne-serveur.log')` |
| 363 | « la page anglaise ne contient aucun libellé de la page française » | `'Site indisponible pour l’instant'` → `'Le serveur est en panne pour l’instant'` (ne passe pas en échec, mais ne vérifie plus rien sur ce libellé) |

`retry` (« Réessayer », « Try again ») et `back` restent justes. Aucun autre test ne cite ces textes
(`grep -rn "erreur-50x\|Site indisponible\|temporarily unavailable\|could not answer" apps/web/app apps/web/test`).

## Vérifications

| Critère | Commande | Résultat |
|---|---|---|
| Lint | `pnpm lint` (apps/web) | code 0, zéro avertissement |
| Typecheck (parcours compris) | `pnpm typecheck` (apps/web) | code 0 |
| Formatage | `pnpm exec prettier --write` des cinq fichiers, puis `--check` | conforme |
| Nouveaux tests et voisins | `pnpm exec vitest run --project nuxt app/error-outage.spec.ts app/error-server.spec.ts app/error.spec.ts app/i18n-messages.spec.ts app/i18n-hardcoded.spec.ts` | 28 passés, 3 en échec (les trois obsolètes ci-dessus) ; `error-outage.spec.ts` 11/11 |
| Couverture | `pnpm --filter @siteperso/web test:coverage` | 1194 passés, 3 en échec (obsolètes) : Vitest ne publie pas la couverture sur échec |
| Couverture (diagnostic) | `pnpm exec vitest run --coverage --coverage.reportOnFailure` (apps/web) | 100 % : instructions 1469/1469, branches 798/798, fonctions 491/491, lignes 1308/1308 ; mêmes 3 échecs |
| Génération | `pnpm --filter @siteperso/web generate:fixtures` | code 0, 21 routes ; `50x.html` et `en/50x.html` : un seul `<script>` (`data-hid="theme"`), deux feuilles de style, préchargement de police ; titre, h1, deux paragraphes et `<title>` attendus ; bouton `<a href class="base-button base-button--solid base-button--lg … error-page__retry">` (`href` sans valeur = chaîne vide en HTML) ; règles `.base-button--solid` et `.error-page__actions` présentes ; `panne-serveur.log` ; `sitemap.xml` sans `50x` |
| Mutation | sans objet | `app/domain/` et `app/data/` non touchés |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » (porte sur les commits : rien de commité ici) |

Non lancés (consigne : Podman bloqué) : `server-outage.e2e.ts`, `server-error.e2e.ts`, `csp.e2e.ts` ;
`pnpm db:down` sans objet (aucun conteneur démarré).

## Décisions

- **Bouton par `LinkButton`** (`solid`, `lg`), pas un style propre à `error.vue` : même apparence que les
  boutons de la page travaux (lot 34) et de l'accueil, rendu en `<a>` sans script. Écarté : `Button.vue`
  (un `<button>` demande JavaScript pour recharger) et un style recopié dans `error.vue`.
- **Classe `error-page__retry` gardée** sur le bouton : les tests existants qui vérifient son absence hors
  page serveur (l. 56 et 134 de `error-server.spec.ts`) gardent leur sens.
- **Second paragraphe** (`serverError.next`) : sépare le constat (en panne, pas du fait du visiteur,
  temporaire) de la conduite à tenir (réessayer, revenir plus tard), lu juste avant le bouton.
- **Mécanisme inchangé** : la génération montre un seul script (thème) et les feuilles de style du
  bouton déjà présentes ; aucune nécessité de toucher `nuxt.config.ts` ni `domain/server-error-page.ts`.

## Points ouverts

1. **Tests obsolètes** : correcteur, sous `Justification-test: L35-TESTS` (tableaux ci-dessus), avant tout
   commit de ces changements (le pre-commit échoue sinon).
2. **Parcours non exécutés** : `server-outage.e2e.ts` (nouveau) et les parcours existants des pages
   d'erreur doivent tourner dès que Podman est libre (`playwright test test/server-outage.e2e.ts
   test/server-error.e2e.ts test/csp.e2e.ts`) ; c'est la preuve de l'absence de coupure de mot à 390 px.
3. **Textes** : à valider par Julien (tableau ci-dessus) ; une fois validés, éventuellement à reporter
   dans la liste « Traductions EN de l'interface » de `docs/front-a-traiter-par-julien.md`.
4. **Commit** : à faire après la mise à jour des tests ; découpage proposé : `feat(web): page « panne du
   serveur » (D48)` (error.vue, common.json fr/en, `error-outage.spec.ts`), puis `test(web): parcours de la
   page « panne du serveur »` (`server-outage.e2e.ts`), puis ce compte rendu.
