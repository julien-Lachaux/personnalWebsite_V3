# Recette CdP du lot F3b (composants de la coquille) — 20 novembre 2026

Branche `lot/F3b-coquille` (8 commits depuis 961a2e6), isolation Docker `siteperso-v3-f3b`.
Journaux : `recette-f3b-*.log` (scratchpad de session).

## Verdict : accepté avec réserves

## Preuves rejouées

| Critère | Commande | Résultat |
| --- | --- | --- |
| Check complet | `TURBO_FORCE=true pnpm check` | 1re passe : code 1 (réserve 1) ; 2e passe : **code 0**, 12/12 puis 4/4 tâches |
| Couverture | `test:coverage` (dans le check) | web 617/617 instructions, 356/356 branches, 175/175 fonctions, 548/548 lignes ; contrats et API 100 % |
| Mutation front | `pnpm test:mutation` (apps/web) | score 100,00 = seuil 100 ; `action-bar.ts` 100 (54 mutants), `preferences.ts` 100 (85), aucun survivant, code 0 |
| Intégrité | `pnpm integrity develop` | OK, code 0 |
| Périmètre | `git diff --stat 961a2e6...HEAD` | 45 fichiers, tous sous `apps/web` (`components/shell`, `composables/shell`, `i18n/locales/{fr,en}/shell.json`, `domain/action-bar*`, `domain/preferences.ts`, `domain/preferences-clear.spec.ts`) plus le compte rendu du dev ; aucun fichier partagé, aucun composant `base/` touché |
| Tests existants | diff `--diff-filter=MD` | aucun test modifié ni supprimé : seuls `preferences.ts`, `en/shell.json`, `fr/shell.json` sont modifiés (+162/-3, ajouts) ; D11 par ajout (`clearPreferences`, `RemovablePreferencesStorage`, `ClearStatus` ; `resetPreferences` conservée, test d'origine intact) |
| Marqueurs interdits | grep du diff (marqueurs de saut, de focus, d'attente ou d'échec attendu de Vitest ; commentaires d'ignore de couverture) | aucun |
| E-mail réel | grep du diff | uniquement des adresses de test en `example.org` ou `a@b.fr`, `a@b.org`, `x@y.org` ; le `mailto:` vient de `useRuntimeConfig().public.contactEmail` (`useContactLink`) |
| Cycles édition-test | `git log --name-only` | un seul fichier touché deux fois (`ActionBar.vue`, 66 px) ; pas de tâtonnement |
| Garde-fous | `.claude/hooks/audit.log` | voir réserve 4 |

## Fond (lecture du code et des tests, étayée par la couverture et la mutation)

- `BottomNav` : `aria-current="true"` sur l'onglet actif, `nav` nommé, cible `--touch-target` (44 px), hauteur `--mobile-nav`.
- Panneau d'accessibilité : `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, focus sur le premier réglage à l'ouverture, Échap ferme et rend le focus au déclencheur (tests lignes 52 à 109 du spec), cinq `Switch` de base, taille du texte en `SegmentedControl` (`aria-pressed`), Réinitialiser par `clearPreferences` (D11).
- Barre d'actions : logique pure dans `domain/action-bar.ts` (seuil 24 px, verrou 360 ms, état initial au changement d'onglet), 100 % mutation ; `useActionBar` retire son écouteur au démontage (test dédié) et lit `Date.now` par défaut.
- Rendu serveur : `window` et `document` uniquement dans `onMounted` ou derrière une garde (`usePreferences` rend `null` sans `window`) ; tests de rendu serveur présents. Écouteurs et observateurs retirés au nettoyage (`usePreferencesSync`, `useScrollHint`).
- Cibles tactiles : 44 px (`--touch-target`) sur mobile et tablette, 40 px sur le bureau ; contrôle axe livré (`axe.spec.ts`).
- Valeurs en dur : aucune couleur ni dimension de composant ; restent quelques décalages décoratifs en px (`translateY(-2px/3px)`, ombre `0 4px 14px`, liseré 3 px) et les points de rupture 1023/767 px dans les media queries : écart mineur, non bloquant.

## Retrait d'un test au hasard (clone jetable, supprimé)

Tirage (`shuf`) : `useActionBar.spec.ts`, « lit l'heure de Date.now par défaut » (28 lignes retirées). `pnpm test:coverage` du front : 554 tests verts, **couverture toujours 100 %**, code 0. Le test est donc redondant pour la couverture : la branche `Date.now` par défaut est atteinte par d'autres tests. Son apport propre est le contrôle de la frontière du verrou (5359 / 5360) avec une horloge simulée ; le composable n'étant pas muté par Stryker (seuls `domain/` et `data/` le sont), rien ne prouve qu'un autre test couvre cette frontière au niveau du composable. Constat, non bloquant ; pas de second tirage.

## Tests de réserve OpenAPI

Sans objet : aucune route ni aucun contrat modifié (aucun fichier hors `apps/web`). Non exécutés.

## Écarts annoncés par le dev (tracés, non bloquants)

1. Sélecteur de langue affichant la langue cible (« EN » sur la page française), la maquette affichant la langue courante.
2. « Recs » laissé en anglais.
3. Sujet du `mailto` à confirmer.
4. Prop `label` nécessaire sur `Popover` et `Window` pour D18 : non livrée dans ce lot (`components/base/` inchangé), à traiter dans un lot ayant ce périmètre.
5. Slot `trigger` de `Popover` typé `string`.

## Réserves

1. **Première passe de `pnpm check` en échec, hors périmètre du lot.** Code 1 : 8 tests axe de `design-system.e2e.ts` en `fullhd-1920` (délai de 30 s dépassé sur `page.evaluate`) alors que 181 autres e2e passaient, avec en parallèle 9 échecs de délai (jusqu'à 27 s) dans `apps/api/test/matrix.e2e-spec.ts`. Le lot ne modifie ni l'API ni `design-system.e2e.ts` ; la signature est celle d'une surcharge de la machine (e2e web et API simultanés), pas de la course `#app-manifest` annoncée. La seconde passe, relancée une fois à l'identique, est verte (code 0). À surveiller : ces délais de 30 s peuvent resurgir à la fusion.
2. Test redondant constaté au retrait (ci-dessus).
3. Écarts 1 à 5 à décider par la session front.
4. **Journal des garde-fous** : `audit.log` ne porte ni chemin de worktree ni numéro de lot ; les refus du jour pour le rôle `dev-front` (Bash : écritures illisibles, scripts écrits puis exécutés, `python3` mentionnant `apps/web`) ne peuvent pas être attribués avec certitude à ce lot. Aucune autorisation ne concerne `dev-front`. Aucune tentative répétée du même contournement relevée ; ce sont des refus de forme de commande, pas de contournement de test.

## Décisions à demander à Julien

- Le sélecteur de langue doit-il afficher la langue courante (maquette) plutôt que la langue cible ?
- Le sujet du `mailto` proposé par le dev est-il validé ?
- La prop `label` de `Popover` et `Window` (D18) doit-elle être livrée dans un lot dédié avant F3c ?
