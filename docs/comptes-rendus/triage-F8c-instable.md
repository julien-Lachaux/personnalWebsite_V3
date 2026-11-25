# Triage F8C-1 : parcours XP instable en CI (23 novembre 2026)

Rapport de l'agent triage, consigné par l'orchestrateur (le rôle triage n'écrit pas dans `docs/`).

- Test : `apps/web/test/experience.e2e.ts`, « axe WCAG 2.2 AA, palette clair renforcé » >
  « suggestions et autres expériences » (l. 669–682), projet `ultra-3440`, fr. Run GitHub 45154790264,
  tentative 1 (PR #14 du back) : `toBeVisible()` de `locale.partial` (« En partie : Docker ») en
  échec après 5 s, « element(s) not found » ; passé à la relance.
- Gravité : mineure (instabilité de CI). **Classe B, test faux établi** : le test clique pendant un
  changement de mise en page. Pas de défaut de produit (classe A écartée).
- Preuve (artefact `front-parcours-ultra-3440` de la tentative 1, contexte d'erreur et trace
  `ca24b90e…zip`, extraits dans le scratchpad `triage-f8c-trace`) :
  - au moment de l'échec, le panneau du filtre est ouvert et le bouton est toujours « Voir les 6 autres
    expériences » : le clic de la l. 679 ne l'a pas atteint ;
  - trace : après `fill('')` (78458 ms), le clic est vérifié « visible, enabled and stable » à
    78518 ms au point (1592,5 ; 811,06), bouton à y = 791, hauteur 40 ; mesuré localement panneau
    ouvert, le bouton est à y = 973, le panneau mesurant 182 px : 791 + 182 = 973. Le bouton était
    encore à sa position sans panneau au contrôle de stabilité ; le panneau (rouvert par `fill('')`,
    requête vide) a poussé la liste juste après, et le clic est tombé dans le panneau ;
  - non reproduit en local (160/160 en `--repeat-each=20`, sondes à CPU ×6/×10/×20, 0 échec) : le
    runner CI chargé (test à 7,6 s au lieu de 4,5 s) mesure la mise en page une image trop tard.
- Pas de défaut utilisateur : le panneau s'ouvre de façon synchrone et personne ne clique dans les
  millisecondes qui suivent la saisie ; section testée en mouvement réduit (aucune animation en cause).
- Correction (correcteur, `Justification-test: F8C-1 clic avant la fin de la mise en page du panneau`) :
  entre `fill('')` et le clic, attendre l'état final du panneau
  (`await expect(drawer(section)).toHaveClass(/filter-drawer--open/)`), et après le clic vérifier
  `aria-expanded="true"` sur le bouton ; même motif `fill('')` puis clic à vérifier ailleurs dans le
  fichier.
- Vérification : `pnpm --filter @siteperso/web exec playwright test test/experience.e2e.ts
  --project=ultra-3440 --workers=2 --repeat-each=20 -g "suggestions et autres"`, idem
  `--project=desktop-1280`, puis une passe complète de `experience.e2e.ts`.
