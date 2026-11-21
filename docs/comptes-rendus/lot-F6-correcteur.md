# Lot F6 : correction F6-TESTS (correcteur)

Date : 21 novembre 2026. Branche `lot/F6-mosaique`. Autorisation 2933b4f8 (tests : `mosaic.e2e.ts`,
`f6-captures.e2e.ts`, `sections.e2e.ts`). Aucun code de production du lead modifié.

## Patch `lot-F6-mosaic-e2e.patch` (appliqué tel quel, `git apply`), fichier par fichier

Seul `apps/web/test/mosaic.e2e.ts` est touché (fichier créé par le lead pendant le lot). Chaque hunk relu
contre SPEC § 4 et D10 :

| Hunk | Correction | Fidèle au comportement voulu ? |
|---|---|---|
| l. 128 et 340 | annotation `(element: HTMLElement)` (TS2339, `no-unsafe-*`) | oui, typage seul |
| l. 229 (1024, XP agrandie) | IA attendue poussée par le bas : `ai.y >= 712` au lieu de `ai.x >= 1024` | oui : D10, IA est dans la même colonne que XP, donc poussée par le bas (Profil à gauche, Recos à droite) ; l'assertion reste stricte (hors zone de 712 px) |
| l. 270 (clavier) | onglet 3 (Recos) au lieu de 4 (IA) : même vérification (focus sur `#section-…`, tuile agrandie non inerte, Tab reste dans la tuile) | oui : l'IA n'a aucun élément focalisable, Tab sortait donc de la tuile ; Recos en a (lien source), la vérification n'est pas affaiblie |
| l. 416 (animation) | `left` et `width` obligatoires, toute propriété animée dans {left, top, width, height, transform}, durée 550 ms et courbe inchangées | oui : seules les propriétés qui changent s'animent (à 1024 le Profil garde `top`) ; le test garde « durée et courbe » et refuse toute autre propriété |

`apps/web/test/f6-captures.e2e.ts` : supprimé (fichier temporaire, jamais commité).

## `sections.e2e.ts` : « marge haute du contenu », branche bureau

Test devenu obsolète (D23) : en mosaïque, `<main>` n'a plus de `padding-top`, les 12 px sont l'écart `GAP`
de `computeLayout`. Le parcours `mosaic.e2e.ts` vérifie déjà les positions (y = 12 aux cas 1280 et 1024,
`GAP` ailleurs), mais la vérification est conservée dans le test d'origine, sous une forme équivalente.

Avant (branche mobile/tablette inchangée) :

```ts
if (!tabsMode(page)) {
  // Bureau : la marge de la zone de 1440 px, la même pour toutes les sections.
  expect(await paddingTop()).toBe('12px');
  return;
}
```

Sortie avant (`f6-e2e2.log` du lead) : 10 échecs, `Expected: "12px" Received: "0px"` (5 tailles ≥ 1024 x fr, en).

Après :

```ts
if (!tabsMode(page)) {
  // Bureau (mosaïque, F6) : <main> n'a plus de marge ; les 12 px sont l'écart entre tuiles de
  // `computeLayout` : la première tuile est à 12 px du haut de la zone.
  const offset = await page.evaluate(() => {
    const zoneTop = document.querySelector('main#contenu')!.getBoundingClientRect().top;
    const tileTop = document.querySelector('[data-tile="profile"]')!.getBoundingClientRect().top;
    return tileTop - zoneTop;
  });
  expect(offset).toBe(12);
  return;
}
```

## Vérifications ciblées

| Quoi | Résultat |
|---|---|
| `pnpm --filter @siteperso/web lint` et `typecheck` | verts (`f6-tests-lint.log`) |
| `pnpm --filter @siteperso/web test:coverage` | 99 fichiers, 1035 tests, 100 % (1304/1304, 708/708, 418/418, 1163/1163) |
| Playwright `mosaic`, `sections`, `shell`, `experience` (`--workers=4`) | 1190 passés, 0 échec (`f6-tests-e2e.log`) |
| `pnpm integrity develop` | OK (voir fin du compte rendu) |

## Non fait / points ouverts

Les points ouverts 3 à 6 du compte rendu du lead (turbo `passThroughEnv`, tuile IA vide, Profil à S = 0,6,
saut au chargement) restent à l'orchestrateur ; rien n'a été changé dans le code de production.
