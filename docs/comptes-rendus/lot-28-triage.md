# Lot 28 : triage du parcours instable de la coche des puces

Rôle : triage (compte rendu transcrit par la session principale, le rôle triage n'écrivant que
`docs/revues/`). Date : 25 nov. 2026. Branche : `lot/28-coche-hydratation`, depuis `develop` (a80fe02).

## L28-01 : « la puce pressée d'une carte porte la coche » intermittent

- **Gravité** : majeur. La CI échoue au hasard et bloque des pull requests sans rapport avec le front
  (PR 18 : écrans mobile-390, tablette-834 puis fullhd-1920) ; aucun utilisateur n'est touché.
- **Test** : `apps/web/test/chip-pressed-mark.e2e.ts:93`, assertion
  `expect((await mark(idle)).content).toMatch(/^(none|normal)$/)`, qui reçoit `""`.

### Reproduction

1. `pnpm --filter @siteperso/contracts build` (sans cela, `generate:fixtures` échoue dans un worktree neuf).
2. `pnpm --filter @siteperso/web generate:fixtures`.
3. `npx playwright test test/chip-pressed-mark.e2e.ts -g "puce pressée d" --repeat-each=40 --workers=2 --project=mobile-390 --project=tablette-834 --project=fullhd-1920`.

Résultat : 2 échecs sur 120 (1,7 %), sur mobile-390 et fullhd-1920, même assertion qu'en CI.

### Cause

Sonde jetable (hors dépôt) suivant la même séquence que le test (`goto('/')`, `toBeVisible()` sur la
première puce `aria-pressed="false"`, puis lecture de `isConnected`, de l'hydratation et du `content`
de `::before`), 150 passes à 1280 px :

- 33 fois `{"connected":false,"hydrated":true,"content":""}` ;
- 117 fois `{"connected":true,"hydrated":true,"content":"none"}`.

`getComputedStyle` d'un nœud détaché renvoie `""`. `AppShell.vue` choisit son mode côté client
(`useShellMode()` vaut `null` avant le montage, `TileGrid v-if="mode==='mosaic'"`) : le HTML prérendu
contient les puces hors mosaïque, et au montage à 1280 px la coquille passe en mosaïque et les remplace.
Le locator est déjà visible sur le HTML prérendu, d'où la fenêtre de course. Ce re-rendu est voulu :
ce n'est pas un défaut de l'application (rien pour F11-02).

L'attente en usage dans les autres parcours (`controls`, `journeys`, `shell`, `sections`,
`design-system`, `experience`, et `openFilter` de ce même fichier) est
`await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1)` après `goto`. Seul ce test l'omet.
Avec cette attente dans la sonde : 150 fois `connected:true` et `content:"none"` (0 détaché contre 33).

### Verdict et correction attendue

Test faux (attente insuffisante), à corriger par le correcteur : dans le test de la ligne 93, ajouter
après `await page.goto('/');`

```ts
await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
```

Rien d'autre : les assertions `none|normal` puis `✓` restent, sans délai ni nouvel essai. Le commit porte
`Justification-test: L28-01 …`. Critères : la reproduction avec `--repeat-each=150` sur trois projets
donne 0 échec ; `pnpm integrity` passe.

## Fait, non fait, décisions, points ouverts

- Fait : reproduction (2/120), cause mesurée (33/150 nœuds détachés, 0/150 après attente), verdict.
- Non fait : la correction (correcteur).
- Décisions pour Julien : aucune.
- Point ouvert : aucune commande docker ou podman lancée ; conteneur Playwright du lot (port 5810) utilisé.
