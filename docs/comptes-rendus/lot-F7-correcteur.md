# Lot F7 : correcteur (F7-TESTS)

Date : 21 novembre 2026. Branche `lot/F7-annexes`. Autorisation c67011fa. Objet : débloquer et
commiter le lot F7 du lead-architecte (tests créés par le lot pris à tort pour des tests existants).

## Fichiers de test (patch `lot-F7-tests.patch`, appliqué tel quel)

| Fichier | Ce que le patch change | Pourquoi | Ce qui reste vérifié |
|---|---|---|---|
| `composables/seo/useSeo.spec.ts` | commentaire `eslint-disable vue/one-component-per-file` localisé | deux racines de test sans gabarit dans un fichier | assertions inchangées |
| `error.spec.ts` | `beforeEach` remet la langue à `fr` (`$i18n.setLocale('fr')`) ; `get(...).exists()` devient `find(...)` | la langue `en` d'un test restait pour le suivant (2 échecs) ; `get` lève si absent, erreur de typage | mêmes attentes, isolation des tests |
| `i18n-hardcoded.spec.ts` | `[ok]` ajouté aux invariants ; `title` ignoré seulement sur les composants (`tagType` natif) ; types `Record`, tuples | `title` de `BaseWindow`/`Popover` est une prop, pas un attribut HTML ; `[ok]` du terminal est identique en fr et en | témoin étendu (`<BaseWindow title>` non relevé, éléments natifs toujours relevés) ; la liste des textes en dur reste vide |
| `plugins/localized-error-page.spec.ts` | type tuple au lieu de `Array<…>` | règle lint | aucune |
| `test/pages.e2e.ts` | `querySelector<…>`, `map` typé en tuple, `interface`, `parent?.closest(...)` | lint et typecheck ; l'expression de garde est équivalente (parent nul : on passe) | aucune assertion modifiée |

Réserve : le filtre `tagType` natif ne relève plus un `title` écrit en dur sur un composant
(`BaseWindow`) ; c'est ce que le témoin acte. À revoir si l'on veut les couvrir par un autre moyen.

## `HomePage.spec.ts` (D23, chemin anglais `/en/accessibility`)

Test « relie le CV PDF de la langue et la déclaration d'accessibilité localisée », ligne 134 :

```
avant : expect(wrapper.get('.a11y-panel__link').attributes('href')).toBe('/en/accessibilite');
après : expect(wrapper.get('.a11y-panel__link').attributes('href')).toBe('/en/accessibility');
```

Avant : échec, reçu `/en/accessibility` (constat du lead, rejoué par le lot). Après : vert. Rien
d'autre ne change.

## Vérifications ciblées (machine partagée : 4 workers)

| Critère | Résultat |
|---|---|
| `pnpm --filter @siteperso/web lint` | code 0, zéro avertissement |
| `pnpm --filter @siteperso/web typecheck` | code 0 |
| `vitest run --coverage --maxWorkers=4` | 108 fichiers, 1046 tests réussis ; couverture 100 % (1264/1264 instructions, 697/697 branches, 417/417 fonctions, 1126/1126 lignes) |
| Playwright `pages.e2e.ts` + `smoke.e2e.ts`, `--workers=4` | 133 réussis (7 tailles) |
| `pnpm integrity develop` | voir résumé final |

## Commits

Le pre-commit rejoue lint, typecheck et tests de tout l'arbre (environ 5 min par commit), d'où cinq
commits : domaine, composables SEO, pages annexes (déclaration, 404, greffon, libellés, configuration
Nuxt, avec les trois tests du lot et `HomePage.spec.ts`), parcours `pages.e2e.ts`, documents.

## Non fait / points ouverts

- Un script shell écrit puis lancé dans la même commande a été refusé par le garde-fou (« illisible,
  donc refusé ») : commits lancés un par un, sans contournement.
- Cause du verrouillage des tests neufs (instantané des hooks) : toujours à examiner côté garde-fous.
