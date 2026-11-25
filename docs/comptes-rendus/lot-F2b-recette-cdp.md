# Recette CdP du lot F2b : logique pure de la mosaïque, du facteur S et des préférences

Date : 20 novembre 2026. Branche `lot/F2b-tuiles` (df7f9f4), base `develop` (b5bf2e4), worktree
`.claude/worktrees/lot-F2b-tuiles`, isolation `siteperso-v3-f2b` (5872-5875).

**Verdict : accepté avec réserves** (aucune correction bloquante ; trois questions pour Julien, un test redondant).

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| Garde-fous, lint, typecheck, unitaires, e2e, couverture | `pnpm check` | code 0 ; Turbo 12/12 puis 4/4 ; web 111 tests unitaires, Playwright 35 ; api 753 e2e |
| Couverture 100 % | dans `pnpm check` | web 185/185 instr., 74/74 branches, 35/35 fonctions, 165/165 lignes ; contracts 59/59 ; api 765/765 |
| Mutation front | `pnpm --filter @siteperso/web test:mutation` | code 0, score 100,00 ; fit.ts 43 tués + 1 timeout, layout.ts 246, preferences.ts 75 ; 0 survivant, 0 sans couverture ; seuil de rupture 100 tenu |
| Pas de Stryker disable ni équivalent | recherche dans les sources et `stryker.equivalents.json` | rien ajouté (diff : 8 fichiers ajoutés seulement) |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » |
| Architecture du domaine | `architecture.spec.ts` dans `pnpm check` | vert |
| Périmètre | `git diff --stat develop...lot/F2b-tuiles` | 8 fichiers, tous `A` : layout.ts, layout-types.ts, fit.ts, preferences.ts, 3 specs, compte rendu du dev. Aucun fichier partagé |

`pnpm check` n'a été lancé qu'une fois (recette de lot, pas recette finale), sur conteneurs du lot recréés par le check.

## Fond

- Règles § 3-4 : une couverture de comportement existe pour les modes par largeur (767/768/1023/1024/1199/1200), le plafond 1440 (1440, 1920, 3440, décalage arrondi), les gouttières de 12, le Profil à hauteur de contenu ou pleine hauteur (mesuré, non mesuré, plafonné), la tuile agrandie `min(dispo, 868)` avec mesure à 865 px, la colonne latérale à 340 px exactement et 339 refusé, les parts égales (hauteur impaire), la poussée dans les quatre directions, l'empilement Profil + IA (égalité acceptée, non mesuré refusé, jamais XP ni Recos), le mode `reduced` / `scrolling`.
- Recalcul à la main contre `renderVals()` et la capture `desktop-1280_xp-agrandi_sombre.png` :
  - mosaïque 1280×788 : Profil 420, XP 1280 − 848 = 432, colonne droite 380, IA et Recos de (764 − 12)/2 = 376, Recos en y = 400 ;
  - XP agrandie 1280×788 : tuile 868, colonne latérale 1256 − 868 − 12 = 376 ≥ 340, hauteur 764 − 24 = 740 en 247 / 246 / 247 px (la maquette donne 246,67 ; écart de 1 px, arrondi cumulé sans trou). Conforme à la capture (tuiles Profil, Recos, IA empilées à droite, XP de 12 à 776 de haut).
- fit : bornes 0,6-1, S = 1 si le contenu tient (tolérance 0,5 px), dichotomie en 10 pas, jamais au-dessus du S exact, largeur plafonnée à 820, cache par (largeur, hauteur arrondie, texte agrandi), invalidation, désactivation texte agrandi : chacun testé.
- preferences : défauts système, stockage absent, qui lève (lecture et écriture), corrompu, ancienne version, champ invalide remplacé par le défaut, réinitialisation : chacun testé.

## Écarts annoncés par le dev

1. **Profil pleine hauteur en 2 colonnes** : conforme à la SPEC § 3.3 (« toute la hauteur ») et à la maquette portable. § 4.1 (« s'arrête à la hauteur de son contenu sur les écrans hauts ») est ambigu sur ce point ; le dev l'applique à 3 colonnes seulement.
2. **Poussée par le haut** : absente de la SPEC § 4.2 (gauche, droite, bas), présente dans la maquette (tuile de même colonne au-dessus de la tuile agrandie). Conforme à la maquette, la SPEC est incomplète.
3. **Réinitialisation qui écrit les défauts** : la SPEC ne dit rien ; le port `getItem/setItem` n'a pas de suppression. Sans effet visible tant que le système ne change pas.

Questions fermées pour Julien :
- Q1 : en mosaïque 2 colonnes, le Profil doit-il rester pleine hauteur (comme la maquette portable) ? oui / non.
- Q2 : ajoute-t-on la poussée « par le haut » à la SPEC § 4.2 pour la rendre conforme à la maquette ? oui / non.
- Q3 : « Réinitialiser » doit-il écrire les défauts dans le stockage (état actuel) plutôt que supprimer la clé, quitte à ne plus suivre un changement ultérieur du système ? oui / non.

## Processus

- Aucun test existant modifié ni supprimé (tous les fichiers du diff sont ajoutés) ; aucune ligne `Justification-test` requise ni présente. Recherche de `skip`, `only`, `todo`, `ignore`, `Stryker` : rien.
- `.claude/hooks/audit.log` : aucune entrée (refus, autorisation, violation) pour ce worktree ni de rôle dev-front.
- Cycles édition-test : chaque fichier de code et de test dans un seul commit (le compte rendu dans deux) ; aucun cycle anormal. Transcription non fournie, non examinée.
- **Retrait d'un test au hasard** (`shuf`, clone jetable, projet `unit` exécuté avec la configuration du worktree, un `pnpm install` dans le clone étant refusé par les garde-fous : `node_modules` n'est pas écrivable pour mon rôle) : `preferences.spec.ts`, « rend null quand il n'y a rien (null) » retiré. Résultat : 102 tests verts, couverture domaine toujours 100 % (173/173, 72/72, 31/31, 156/156). **Test redondant** : le cas `parsePreferences(null)` est déjà couvert par les autres tests (JSON `null` refusé comme document sans version). Réserve mineure, à ne pas corriger sans le triage (un test se supprime seulement par le correcteur). Un seul tirage effectué.
- Tests de réserve OpenAPI : sans objet, le lot n'a ni route ni API (logique pure front).

## Réserves

- R1 : test redondant ci-dessus (faible).
- R2 : `TILE_CHROME.height = 48` vient de la maquette ; à vérifier contre le CSS de la tuile en F3.
- R3 : pas de borne basse sur `zone.height` (hauteurs négatives sous 24 px) ; le composable de F3 doit garantir la hauteur réelle.
