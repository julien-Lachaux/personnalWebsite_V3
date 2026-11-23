# Triage des revues du front V3 (lot F10), 23 novembre 2026

## En-tête

| | |
|---|---|
| Entrées | `docs/revues/code-front-2026-11-23.md` (RC-1 à RC-10), `docs/revues/securite-front-2026-11-23.md` (RS-1 à RS-6), `docs/revues/a11y-front-2026-11-23.md` (RA-1 à RA-10) |
| Commit examiné | `3da5b88` sur `lot/F10-revues` (develop à `ba79093`) |
| Méthode | Chaque constat est relu dans le code, puis rejoué quand il est observable : site généré `generate:fixtures` (15 routes, code 0), navigateur Chromium du service `playwright`, sondes Node écrites hors dépôt, parcours existant rejoué tel quel pour RC-1. Constats de configuration rejoués par commande (`pnpm audit --prod`, `node -e` sur le motif de `cvPath`, `grep`, `docker-compose.yml`). Calculs de contraste refaits à la main (formule WCAG). |
| Isolation | `.env` du worktree (`siteperso-v3-f10`, 5962 à 5965). Site servi par `sirv` sur 127.0.0.1:5975, navigateurs sur 5964. Sondes et journaux : scratchpad de session, préfixe `triage-f10-`. Aucune base utilisée. |
| Nettoyage | `sirv` arrêté (aucun port 5975 à l'écoute), `pnpm db:down` fait (conteneur et réseau retirés), `apps/web/.output/` régénéré (ignoré par git, contenu fixtures avec section IA). `git status` ne montre que ce rapport. |
| Intégrité | Aucun code ni test modifié. Un refus des garde-fous : voir « Points ouverts ». |
| Résultat global | 26 constats (25 entrées après fusion RC-2 = RS-3), tous confirmés, aucun faux positif. 1 bloquant (RA-1), 3 majeurs (RA-2, RA-3, RC-1). Un seul test est établi faux (RC-1). À corriger maintenant : 11 constats (RA-1 à RA-6, RA-9, RC-1, RC-6, RC-10, RA-4) ; reporté : RC-2/RS-3 (F11), RC-5 ; briefs back : RS-1, RS-5/RC-8 ; décisions de Julien : RS-2, RA-7, RA-8, RA-10, RC-3, RC-4 ; sans suite : RC-7, RC-9, RS-4, RS-6. |

Doublons : RC-2 = RS-3 (même morceau préchargé). RC-8 et RS-5 se rejoignent (la politique de `csp.e2e.ts` recopie celle du script de déploiement, y compris `img-src 'self' data:`). RA-3 et RA-4 ont la même cause (mot qui ne se coupe pas) et se corrigent ensemble. RA-1 et RA-2 touchent la même coquille mobile.

## Tableau

| Id(s) | Gravité retenue | Statut | Destination | Justification |
|---|---|---|---|---|
| RA-1 | bloquant | confirmé | corriger maintenant | Rejoué à 320 × 256 (zoom 400 % de 1280 × 1024) : hauteur visible de la liste XP 0 px, barres fixes 53 + 66 + 64 px (`triage-f10-a11y.cjs`) ; idem 320 × 200 et à 130 %. |
| RA-2 | majeur | confirmé | corriger maintenant | Rejoué à 390 px, onglet XP, 120 Tab : « Lancer l'entretien » et « CV PDF » jamais atteints, barre `action-bar--hidden` et `inert`. |
| RA-3 | majeur | confirmé, précisé | corriger maintenant | Rejoué à 320 px : « Développeur » dépasse de 11 px (texte 115 %), 53 px (130 %) ; pas de débordement à 100 % (-31 px) ni à 390/1280 avec 130 % seul. Le défaut apparaît avec les réglages que le site propose lui-même. |
| RC-1 | majeur (test) | confirmé, **test faux établi** | corriger maintenant | `mosaic.e2e.ts:197`, voir « Tests mis en cause ». |
| RA-4 | mineur | confirmé par lecture, non rejoué | corriger maintenant (avec RA-3) | Même cause que RA-3 ; mesure du rapport (`scrollWidth` 91 pour `clientWidth` 61). |
| RA-5 | mineur | confirmé | corriger maintenant | Rejoué à 1280 : Tab n° 10 sort du panneau, qui reste ouvert, Échap sans effet (écouteur posé sur la racine seule, `Popover.vue:110`). Le masquage total du focus n'a pas été rejoué (Tab n° 69 du rapport). |
| RA-6 | mineur | confirmé | corriger maintenant | Calcul : compteur à 75 % d'opacité sur la puce active 3,80:1 (seuil 4,5) ; sans opacité 6,67:1. `TechChip.vue:90`, `TechOption.vue:57`. |
| RA-7 | mineur | confirmé | décision de Julien | Calcul : texte `#14262b` contre `#1f5c4d` 2,01:1, blanc contre fond de puce 1,17:1. La correction ajoute un indice visuel que le handoff n'a pas. |
| RA-8 | mineur, décision | confirmé (constat), correction contredit D21 | décision de Julien | Code lu : `LanguageSwitch.vue` rend « EN »/« FR » avec `lang` et `hreflang`, nom = texte visible, comme D21 l'écrit. |
| RA-9 | mineur | confirmé par lecture | corriger maintenant | `.a11y-panel__link` sans `min-height` (`AccessibilityPanel.vue:209`) ; exigence du projet, pas WCAG (exception d'espacement de 2.5.8). |
| RA-10 | mineur | confirmé | décision de Julien | Fichier : `%PDF-1.3`, 0 `StructTreeRoot`, 0 `MarkInfo`, 0 `/Lang`, 0 `/Title`. PDF fourni par Julien (D22). |
| RC-2 = RS-3 | mineur | confirmé | reporté à F11 | `index.html` : `<link rel="prefetch" as="script" href="/_nuxt/k2bm6MiX.js">`, 138 603 octets, contient « Prénom » (fixtures) ; seul morceau de ce poids hors framework. |
| RC-6 | mineur | confirmé | corriger maintenant | Rejoué : `/?tech=typescript,nodejs` donne « TypeScript, 0 expériences » (fr) ; en anglais « 0 experiences » est correct. |
| RC-3 | mineur | confirmé | décision de Julien | `resetPreferences` : aucun appelant, commentaire « conservée parce que son test existant ne se modifie pas ». Test obsolète, pas faux : voir plus bas. |
| RC-4 | mineur | confirmé | décision de Julien | Imports de `domain/` et `data/` dans 5 composants (grep), `architecture.spec.ts` ne les vérifie pas. |
| RC-5 | mineur | confirmé | reporté (backlog) | `HomePage.vue:50` lit `cv.profile.firstName/lastName` ; `seo.description` fige le nom ; `docs/04:31` classe ces champs « non affichés ». Aucune erreur visible aujourd'hui. |
| RC-7 | mineur | confirmé (8 fichiers avec `Infinity`, 9 avec `WCAG_22_AA`) | sans suite en F10 | Duplication, pas un test faux : le correcteur n'a pas le droit d'y toucher. Backlog. |
| RC-8 | mineur | confirmé | brief back + décision | `buildPolicy` du test identique, ligne à ligne, à `scripts/deploy/csp-hashes.mjs:76-88` (qui l'exporte). Test non faux : il vérifie sa copie. |
| RC-9 | mineur | confirmé | sans suite en F10 | 4 `waitForTimeout` (3 × 600 ms, 1 × 300 ms) qui attendent l'absence d'un événement ; vrais négatifs, pas des tests faux. Backlog. |
| RC-10 | info | confirmé | corriger maintenant (hors test) | Commentaires périmés de `EasterEggWindow.vue:3-4` et `ContactButton.vue:3-4` ; celui de `test/sections.e2e.ts:172` laissé (modifier un test pour un commentaire n'est pas autorisé). |
| RS-1 | faible | confirmé | brief back | `node -e` : `/\h.example/x.pdf` accepté par le motif, `new URL(…).host` = `h.example`. Contenu écrit par Julien, aucun tiers. |
| RS-2 | faible, décision | confirmé | décision de Julien | `contact@example.org` 13 fois dans le site généré (6 pages HTML + charge utile) ; SPEC § 11 « ne pas publier e-mail ni téléphone en clair ». |
| RS-4 | info | confirmé | sans suite | `pnpm audit --prod` : 1 modérée (minimatch via nitropack > archiver), chaîne de build, pas dans le site publié. À relire à la prochaine mise à jour de Nuxt. |
| RS-5 | info | confirmé | brief back (avec RC-8) | Aucun `data:image` ni `url(data:` dans `.output/public` ; `img-src 'self' data:` posé par `csp-hashes.mjs:82`. |
| RS-6 | info | confirmé (`docker-compose.yml:66-77`, port lié à 127.0.0.1) | sans suite | Outillage de développement, version exacte, image épinglée par digest. |

Faux positifs : aucun. Gravités reclassées : RA-3 maintenu majeur avec une précision (déclenché par la taille du texte ≥ 115 % ou l'espacement, pas par le réglage par défaut) ; RS-2 et RA-8 reclassés en décisions.

## Tests mis en cause

### RC-1 : test faux établi

- Fichier et test : `apps/web/test/mosaic.e2e.ts`, `cas des captures recalculés : 1280 × 844 et 1024 × 768` (l. 197-238).
- Ce qu'il vérifie : seulement les cas où la zone mesurée vaut exactement 1280 × 788 ou 1024 × 712 (`if (!(…)) return;`, l. 201). Le titre annonce 1280 et 1024, en fr et en.
- Preuve (journal `triage-f10-mosaic.log`, sonde `triage-f10-zone.cjs`, fixtures) :

```
1024x768 /    zone 1024x712 topBar 56   -> assertions
1024x768 /en  zone 1024x683 topBar 85   -> retour anticipé, aucune assertion
1280x844 /    zone 1280x788 topBar 56   -> assertions
1280x844 /en  zone 1280x788 topBar 56   -> assertions
✓ [portable-1024] en (/en) › cas des captures recalculés … (667ms)    <- vert sans rien vérifier
✓ [portable-1024] fr (/)    › cas des captures recalculés … (1.3s)
```

- Pourquoi c'est faux : un test qui annonce un cas et passe sans aucune assertion quand la mesure diffère valide aussi bien une mise en page cassée qu'une mise en page juste. Toute variation de la barre du haut (libellé, police) retire en silence les cas fr. Le critère « une assertion utile par test » (CLAUDE.md, Tests) n'est pas tenu.
- Autorisation donnée au correcteur : modifier ce seul test. Correction minimale : décider le cas d'après la configuration (`page.viewportSize()?.width`, valeurs 1024 et 1280, et la langue), jamais d'après la mesure ; dans un cas retenu, exiger la zone attendue (`expect(zone).toEqual(…)`) pour qu'une zone différente fasse échouer le test. Pour 1024 en anglais, asserter la zone réelle 1024 × 683 (défaut connu F5c : barre sur deux lignes) et laisser les positions au test « positions conformes à `computeLayout` » qui mesure la zone ; ne pas inventer de valeurs SPEC pour 683 px. Les autres largeurs (1440, 1920, 3440, < 1024) peuvent rester exclues, par la configuration. Pas de marqueur de saut. Ligne `Justification-test: RC-1 …` avec la démonstration ci-dessus.

### Autres tests cités : pas de test faux établi

- RC-3 (`preferences.spec.ts`, `describe('resetPreferences')`, et `usePreferencesSync.spec.ts` qui importe les réexports) : le test vérifie correctement une fonction que D11 a rendue inutile. Obsolète, pas faux : D23 ne couvre que les tests rendus obsolètes par une décision de Julien, et D11 en est une, mais le choix « supprimer le code et ses tests » est une décision (question Q6). Le correcteur n'y touche pas sans réponse.
- RC-7, RC-9 : doublons de helpers et attentes fixes dans des parcours qui vérifient bien leur comportement. Aucun ne passe pour une mauvaise raison ; non modifiables.
- RC-8 (`csp.e2e.ts`) : le test est exact par rapport à sa copie ; l'écart est une lacune de couverture (la politique servie n'est pas celle mesurée), pas un résultat faux.
- `ActionBar.spec.ts:49` (« repliée et inerte quand elle est masquée ») : il décrit le contrat du composant (`hidden` → `inert`), qui reste valable. Le défaut RA-2 est dans le calcul de `hidden` (`useActionBar`) : voir la correction. Ce test ne doit pas être modifié.

## Corrections à faire maintenant, dans l'ordre

Ordre : bloquant, majeurs (bugs actifs), mineurs rapides. Les corrections 1 à 4 touchent des fichiers partagés (`AppShell.vue`, `ExperienceSection.vue`, `ProfileTitle.vue`, `useActionBar.ts`, `nuxt.config.ts`) : autorisation du lead-architecte. Les nouveaux tests vont dans de nouveaux fichiers.

1. **RA-1 (bloquant)** : fichiers `AppShell.vue` (l. 264-267), `ExperienceSection.vue` (`.experience-section__filter`). Correction minimale : sous une hauteur seuil (`@media (max-height: …)`, à ajuster par mesure, de l'ordre de 30 rem), la coquille cesse de tenir en `100dvh` : la page défile, l'en-tête, la barre d'actions et la zone de filtre passent en statique, la navigation du bas reste seule fixe. Vérifications : nouveau parcours Playwright à 320 × 256 et 320 × 200 (texte 100 % et 130 %), hauteur visible de la liste XP et de chaque onglet au moins égale à un minimum à fixer (par exemple 3 lignes), sans modifier les parcours existants ; `pnpm --filter @siteperso/web exec playwright test test/matrix.e2e.ts --project=mobile-390 --project=desktop-1280` ; lint, typecheck, `test:coverage` du paquet ; aucune régression de capture.
2. **RA-2 (majeur)** : `composables/shell/useActionBar.ts` (et `ActionBar.vue` seulement si nécessaire). Correction minimale : tant que l'utilisateur navigue au clavier (focus dans `<main>` en `:focus-visible` ou `focusin` des derniers éléments), la barre ne se masque pas ; le contrat de `ActionBar.vue` (`hidden` → `inert`) ne change pas. Vérifications : nouveau parcours « Tab depuis le haut atteint Lancer l'entretien puis CV PDF » sur l'onglet XP à 390 et 834 ; `ActionBar.spec.ts` inchangé et vert ; les tests de `useActionBar.spec.ts` existants restent verts (s'ils s'opposent à la correction, sortie honorable). À faire après la 1 : elle peut retirer la barre des petites hauteurs.
3. **RC-1 (majeur, test)** : comme décrit ci-dessus. Vérification : `WEB_E2E_PORT=<port> pnpm --filter @siteperso/web exec playwright test test/mosaic.e2e.ts -g "cas des captures" --project=portable-1024 --project=desktop-1280 --workers=2` (le cas 1024/en doit durer comme les autres et contenir une assertion) ; prouver l'efficacité en rendant la zone attendue fausse dans un clone jetable (jamais dans le dépôt) : le test doit échouer.
4. **RA-3 et RA-4 (majeur, mineur)** : `ProfileTitle.vue` (`overflow-wrap: anywhere` ou taille plafonnée par `cqi`) et `ActionBar.vue` (coupure dans les mots, `flex-wrap`). Vérifications : nouveau parcours de débordement (320 px texte 115 et 130 %, 390 px espacement + 130 %, fr et en) : aucun dépassement du conteneur rogné pour le titre et pour « CV PDF (in French) » ; matrice axe 390 et 1280 ; captures inchangées à 100 %.
5. **RA-6 (mineur)** : retirer l'`opacity: 0.75` du compteur quand la puce est active ou survolée (`TechChip.vue:90`, `TechOption.vue:57`). Vérification : contraste ≥ 4,5:1 calculé dans les quatre palettes (nouveau test de couleurs ou ajout au parcours de contrastes) ; matrice axe.
6. **RA-5 (mineur)** : `Popover.vue` : fermer le panneau quand le focus sort de la racine (`focusout` dont `relatedTarget` est hors racine), sans reprendre le focus. Vérification : parcours « Tab hors du panneau le ferme, Échap du déclencheur rend le focus » ; tests de composant du `Popover` existants verts.
7. **RA-9 (mineur)** : `min-height: var(--touch-target)` et `display: inline-flex; align-items: center` sous 1024 px sur `.a11y-panel__link`. Vérification : nouveau test de mesure de cible à 390 et 834 (hauteur ≥ 44 px).
8. **RC-6 (mineur)** : règle de pluriel française dans `nuxt.config.ts` (`i18n.vueI18n`, 0 au singulier), `experience.json` inchangé. Vérification : nouveau test de composant (compteur 0 d'une techno choisie en fr et en) ; `pnpm --filter @siteperso/web test:coverage` à 100 %. La clé `experience.tech.disabled` reste au singulier voulu.
9. **RC-10 (info)** : corriger les commentaires de `EasterEggWindow.vue` et `ContactButton.vue` ; ne pas toucher `test/sections.e2e.ts`. Vérification : lint.

Puis la recette fait l'unique `pnpm check` (D26).

## Reporté

- **F11** : RC-2 = RS-3 (poids du JS). Correction attendue : charger la source dans le gestionnaire sous `import.meta.server` pour que Vite retire la branche du bundle client, et n'importer `FixtureCvSource` que si `name === 'fixtures'` (import dynamique) ; critère : aucun `<link rel="prefetch">` ne mène à un morceau contenant les fixtures (`grep -l "Prénom" .output/public/_nuxt/*.js` vide sur un build `NUXT_CV_SOURCE=api` hors fixtures) et un test de build le vérifie. Les fixtures publiées ne sont pas un secret (placeholders).
- **Backlog** : RC-5 (nom et description SEO dans `ProfileView` et `seo.description` paramétrée, mise à jour de `docs/04`), RC-7 et RC-9 (parcours : helpers communs dans `test/support/`, horloge `page.clock`) : tâches de test à confier à un agent de développement avec autorisation, pas au correcteur.

## Briefs vers la session back

- **RS-1** : exclure `\` du motif `SITE_PATH_PATTERN` (`packages/contracts/src/profile/profile.ts:10`, premier caractère et suite) et ajouter côté base `cv_path like '/cv/%'` (migration). Critère : test du contrat qui refuse `/\hote/x.pdf` et `//hote/x.pdf`, `pnpm --filter @siteperso/contracts test`.
- **RS-5 et RC-8** : `img-src 'self'` dans `scripts/deploy/csp-hashes.mjs:82` (aucune image `data:` utilisée, vérifié) ; faire importer `collectHashes` et `buildPolicy` de ce script par `apps/web/test/csp.e2e.ts` (ou un test qui compare les deux), pour que le parcours mesure la politique servie. Cette seconde partie modifie un test existant du front : elle passe par une décision de Julien et par le correcteur après triage complémentaire, pas dans ce lot.

## Décisions de Julien (questions fermées)

- **Q1 (RS-2)** : acceptes-tu que l'adresse de contact reste en clair dans le HTML du site (écart avec SPEC § 11, à consigner dans `docs/05`) ? Si oui, utilises-tu une adresse dédiée (alias) pour `NUXT_PUBLIC_CONTACT_EMAIL` en production ? Oui ou non pour chacune.
- **Q2 (RA-8)** : autorises-tu à compléter le nom accessible du sélecteur de langue par un texte masqué (« EN : English version », « FR : version française ») au lieu du nom égal au texte visible fixé par D21 ? Oui ou non. La forme proposée respecte WCAG 2.5.3.
- **Q3 (RA-10)** : fournis-tu un PDF balisé (structure, langue fr-FR, titre) ou fais-tu indiquer dans la déclaration que le PDF n'est pas accessible, la page web tenant lieu de version accessible ? Réponse attendue : « nouveau PDF » ou « mention dans la déclaration ».
- **Q4 (déclaration d'accessibilité)** : acceptes-tu que la rubrique « Contenus non accessibles » liste, à la date de publication, les défauts non corrigés (le PDF au minimum, et RA-1, RA-2, RA-3 s'ils ne sont pas corrigés) ? Oui ou non. (Contenu réservé à toi, `docs/front-a-traiter-par-julien.md`.)
- **Q5 (RA-7)** : ajoutes-tu un indice non coloré à l'état « pressé » des puces en thème clair (coche, graisse ou bordure de 2 px), au prix d'un écart avec le handoff ? Oui ou non.
- **Q6 (RC-3)** : autorises-tu la suppression de `resetPreferences` et de son `describe`, et le retrait des réexports de `usePreferencesSync.ts` avec la mise à jour des imports de son test (sous D23 et `Justification-test`) ? Oui ou non.
- **Q7 (RC-4)** : veux-tu imposer que les composants n'importent aucune valeur de `domain/` ou `data/` (règle vérifiée par `architecture.spec.ts`, refactor en composables), ou écrire dans `docs/05` que les fonctions pures du domaine sont importables par les composants ? Réponse : « imposer » ou « autoriser ».
- **Q8 (placeholder IA)** : le mot « placeholder » servi sans `lang="en"` sur la page française (WCAG 3.1.2) peut-il rester jusqu'à ton contenu définitif ? Oui ou non.

## Sans suite

- **RS-4** : avis de la chaîne de build, hors site publié ; à relire à la prochaine mise à jour de Nuxt.
- **RS-6** : serveur de navigateurs limité à 127.0.0.1, outillage de développement, version exacte.
- **RC-7, RC-9** : voir « Reporté » (pas de test faux, correcteur non autorisé).
- **D29 et D25** (revue a11y) : conclusions de la revue (ellipse conforme, étiquette du filtre conforme) non rejouées ; à entériner telles quelles.

## Fait

- 26 constats classés avec statut et destination ; rejouées : RA-1, RA-2, RA-3, RA-5, RC-1 (parcours et sonde), RC-2/RS-3, RC-6, RS-1, RS-2, RS-4, RS-5, RS-6, RA-10, RC-8 (comparaison de code), RC-10, calculs de contraste RA-6 et RA-7.
- RC-1 établi faux avec preuve ; aucun autre test établi faux.
- Environnement remis en état.

## Non fait

- RA-4, RA-9 non rejoués en navigateur (lecture du code et mesures du rapport citées) ; RA-5 : le masquage total du focus (Tab n° 69) n'a pas été rejoué ; RC-4 : effet sur Stryker non mesuré ; RC-7 : l'attente sans fin de `mosaic.e2e.ts` sur le site sans IA non rejouée (génération sans IA non lancée) ; pas de `pnpm check` ni de lecteur d'écran.
- Les trois points « à vérifier manuellement » de la revue a11y (lecteur d'écran) restent à faire par Julien.

## Décisions

- Reclassement : RA-3 conservé en majeur avec son déclencheur précisé ; RS-2 et RA-8 passés en décisions ; RC-3 et RC-8 traités comme des tests obsolètes ou lacunaires, non faux.
- Le correcteur ne touche qu'un test existant : RC-1.

## Points ouverts

- Garde-fous : une première version de la sonde de zoom, modifiée par `sed` puis relancée dans la même commande, a été refusée (« script écrit par la même commande ») ; je n'ai pas reformulé cette commande et j'ai écrit puis exécuté une sonde distincte. Un `pkill` du serveur `sirv` a renvoyé le code 144 sans effet visible sur la suite (le port est bien libéré).
- Le correcteur doit demander l'autorisation « tests » pour RC-1 uniquement et l'autorisation lead-architecte pour les fichiers partagés cités.
- L'ordre des corrections 1 et 2 est contraignant : la correction de RA-1 peut supprimer la barre d'actions aux petites hauteurs et changer le périmètre de RA-2.
