# Recette du lot F5b (chef de projet), 21 novembre 2026

Branche `lot/F5b-experiences` (7afee8b), base `develop`. Verdict : **accepté avec réserves** (voir « Verdict »).

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| `pnpm check` code 0 | `TURBO_FORCE=true pnpm check` | **Non obtenu en une passe** : 2 essais, échecs dus à la charge (voir ci-dessous) |
| Intégrité | `pnpm integrity develop` | OK |
| Couverture 100 % front | `pnpm test:coverage` dans `apps/web`, seul, charge retombée | code 0, 88 fichiers, 959 tests, seuil 100 % tenu |
| Lint, typecheck front | `pnpm lint`, `pnpm typecheck` dans `apps/web` | codes 0 (`--max-warnings 0`) |
| Contrats et API (couverture) | dans les deux passes de `pnpm check` | verts : contrats 220 tests, API 1194 tests, 100 % |
| e2e front existants (448) | non atteints | `pnpm check` a été interrompu par l'échec du test:coverage front avant ; non rejoués seuls |

Échecs de `pnpm check` (journaux `scratchpad/recette-f5b-check-1.log` et `-2.log`) :

1. Passe 1 : `HookTimeoutError: Hook timed out in 10000ms` dans `beforeAll` (setupNuxt) sur 6 fichiers, dont 3 hors lot (`Popover`, `Window`, `AccessibilityPanel`). Charge machine 30 pour 16 cœurs (un autre worktree, lot-F3c-cv, tournait).
2. Passe 2 (relance autorisée, charge encore à 32 à 35) : un seul test en échec, `axe.spec.ts` « sans filtre, panneau fermé » : `Test timed out in 5000ms`. Contrats et API verts.
3. Même `test:coverage` front relancé seul à charge normale (9) : vert. Le délai de 5 s du test axe est donc sensible à la charge (point de fragilité, voir réserves). Je n'ai pas relancé de troisième `pnpm check` complet : le code 0 d'un `pnpm check` entier reste à constater par l'orchestrateur sur machine calme, avec en particulier les 448 e2e front.

## Diff, périmètre, tests

- 29 fichiers ajoutés ou modifiés, tous dans le périmètre autorisé (composants et composable `experience`, `experience.json` fr/en, compte rendu, patch). Aucun fichier de `domain/`, `data/`, `pages/`, `home/`, `shell/`, `base/`, `assets/css/`, config.
- Aucun test existant modifié ou supprimé (statut git : 25 `A`, 2 `M` sur les seuls `experience.json`, dont aucune clé n'est retirée : 0 ligne supprimée hors en-tête de diff). `HomePage.spec.ts` intact. Aucune `Justification-test` requise.
- Aucun marqueur `skip`, `only`, `todo`, `fails`, `fixme`, aucun commentaire d'ignore de couverture (grep dans `components/experience` et `composables/experience`).

## Journal des garde-fous (dev-front F5b)

Refus relevés pour les deux agents dev-front du 20 nov. au soir : scripts ou écritures opaques (`python3`, `node`, `perl`, script écrit et lancé dans la même commande) et une écriture shell d'un marqueur d'ignore refusée avec renvoi vers l'outil Write. Chaque refus a des motifs distincts, pas de tentative répétée du même contournement. Aucune autorisation nominative utilisée. Aucune violation de fin de tâche relevée pour ces agents. (Mon propre refus : écriture d'un journal à la racine du worktree, déplacé dans le scratchpad.)

## Cycles édition-test

`git log --name-only` : chaque fichier est touché une fois (commits par couche, pas d'allers-retours) ; transcription non fournie, alternances non comptables. Rien à signaler.

## Fond : règles de la SPEC § 5 testées au niveau composant

Couverts par des tests de comportement (`mountSuspended`) : ET strict et groupes (`ResultGroups`), compteurs et désactivation à 0 (`TechOption`, `FilterDrawer`, `SuggestionList`), technos sans XP non cliquables, stack principale, 6 suggestions au plus, Entrée (première valide, saute les à 0), Retour arrière (champ vide seulement), Échap (vide la saisie puis ferme), panneau ouvert au clic et au focus mais pas au focus programmatique, choisir ne ferme pas, `aria-live` (pluriel, singulier, vide), `?tech=` lu, écrit (`replace`, autres paramètres et ancre conservés), accordéon `aria-expanded`/`aria-controls`, easter egg (modale, nom explicite D18, retour du focus sur la puce, voile, Échap, piège de focus).

Lacunes au niveau composant, couvertes seulement par le patch Playwright (non commité) :

- **Mouvement réduit de l'easter egg** : aucun test unitaire (c'est du CSS : `--egg-delay-scale`) ; seul `experience.e2e.ts` le vérifie. Tant que le patch n'est pas appliqué, ce comportement n'a aucun test dans le dépôt.
- **Conservation de `?tech=` au changement d'onglet** : même cas (les sections restent montées ; aucun test de composant, car l'onglet est dans la coquille).

## Retrait d'un test au hasard

Clone jetable, tirage `shuf` : `ExperienceCard.spec.ts` « est replié au départ : bouton nommé, aria-expanded et aria-controls ». Retiré, `pnpm test:coverage` front : **reste vert** (958 tests, 100 %). Test partiellement redondant : le reste de la suite couvre les lignes ; les assertions propres au test retiré (état initial `aria-expanded=false` avant clic, panneau `inert`, nom `Détail : …`, 4 puces de détail) ne sont plus vérifiées par un autre test de la même carte. À noter, non bloquant. Clone supprimé.

## Parcours Playwright (patch) sur clone jetable

Patch appliqué, `HomePage.vue` intégré avec un conteneur flex provisoire (non commité), fixtures, navigateurs Docker, projets `mobile-390` et `desktop-1280` : **128 réussis sur 136** (34 tests × 2 tailles × 2 langues), 8 échecs : les tests « structure : filtre dans une zone fixe… » et « le panneau se ferme au défilement de la liste » (liste non défilante : `toBeGreaterThan(0)` reçoit 0), sur les deux tailles et deux langues. Ce sont les tests liés à la géométrie, que la notice du dev dit dépendre de l'intégration du lead (hauteur définie du parent, `main` sans défilement) ; ma mise en page provisoire ne la reproduit pas. Le chiffre annoncé (476 sur 7 tailles) n'est donc pas confirmé tel quel : confirmé pour 128/136, inconclusif pour ces 2 tests tant que l'intégration réelle n'existe pas. Axe (4 palettes), mouvement réduit, cibles 44 px et focus visible font partie des 128 réussis.

## Tests de réserve OpenAPI

Sans objet : le lot ne touche ni l'API ni le contrat (aucun fichier `apps/api`, `packages/contracts`) ; non générés.

## Points ouverts du dev (tracés, non bloquants)

1. Opacité 0,9 au lieu de 0,6 pour les cartes atténuées (contraste 4,5:1 de la SPEC § 10.2) : à confirmer par Julien.
2. Champ nommé par `aria-labelledby` : cliquer l'étiquette ne donne pas le focus ; `<label for>` exigerait d'assouplir `label-has-for` (lead).
3. « À distance, à distance » (OpenClassrooms) : fixtures antérieures au lot back 17 ; à revérifier avec les données du lot 17.
4. Traductions EN à relire (`filter.*`, `suggestions.*`, `drawer.*`, `tech.*`, `results.*`, `card.*`, `easterEgg.*`).
5. Tokens `--dur-egg-line` et `--dur-egg-bar` à créer dans `tokens.css` (lead), en attendant des variables locales.
6. `HomePage.spec.ts` lignes 91 et 100 deviendront obsolètes à l'intégration (le lead les fait corriger par le correcteur, avec triage).

## Verdict

**Accepté avec réserves.** Rien de contraire au périmètre ni à l'intégrité des tests ; couverture 100 %, lint et typecheck verts. Réserves à lever par l'orchestrateur :

- constater un `pnpm check` complet à code 0 sur machine calme (mes deux passes ont échoué par délai de test sous charge ; seuls constats seuls : coverage, lint, typecheck front) ;
- test `axe.spec.ts` « sans filtre, panneau fermé » à 5 s : fragile sous charge, à surveiller (délai non modifiable par moi) ;
- mouvement réduit de l'easter egg et conservation de `?tech=` entre onglets sans test dans le dépôt avant application du patch ;
- test `ExperienceCard` « replié au départ » partiellement redondant.

Conteneurs arrêtés (`pnpm db:down`), clone supprimé.
