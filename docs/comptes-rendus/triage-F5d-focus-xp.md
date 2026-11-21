# Triage F5D-1 : parcours XP instable en CI (21 novembre 2026)

Rapport de l'agent triage, consigné par l'orchestrateur (les garde-fous refusent au rôle triage
l'écriture de ce chemin).

## Finding F5D-1
- Test : `apps/web/test/experience.e2e.ts`, « panneau : toutes les technos, états, Fermer rend le
  focus sans rouvrir » (l. 270), projet `desktop-1280`, fr.
- Constat : run GitHub Actions 44928473401 (PR #4 du back, sans lien avec le front), job Front,
  `expect(locator).toHaveAttribute` → `element(s) not found` ; 1 échec sur 1 022 parcours, 26,8 min
  de parcours sur un exécuteur à 2 cœurs.
- Gravité : mineure (non déterministe) mais bloquante (la CI de PR est l'unique vérification).
- Statut : **non reproduit**, classe A/B/C **non établie**.
- Assertions candidates : l. 278 (`Toutes les technos (34)`, `aria-expanded=false`) et l. 280
  (`Masquer…`, `aria-expanded=true`).

## Reproductions (site généré sur fixtures, copie du test hors dépôt)
| Conditions | Résultat |
|---|---|
| test seul | 2/2 |
| `--repeat-each=20 --workers=2` | 40/40 |
| CPU ×4 (CDP `Emulation.setCPUThrottlingRate`) | 30/30 |
| CPU ×10 | 30/30 |
| conteneur navigateur à 0,4 cœur, 4 workers | 30/30 (9 s par test) |
| CPU ×8/×20, 0,3–0,5 cœur | échecs par timeout de 30 s (`goto`, clic « Fermer ») : surcharge, pas l'erreur observée |

Aucun événement `scroll` relevé entre le focus du champ et le clic sur « Toutes les technos ».

## Hypothèses (lues dans le code, non prouvées)
1. **(A, composant)** `TechFilter.closeOnScroll` ferme le panneau sur tout `scroll` de la liste
   survenu plus de 450 ms après l'ouverture (`SCROLL_GRACE_MS`) ; fermé, le panneau est
   `visibility:hidden` + `inert`, ses boutons sortent de `getByRole` → « not found » l. 278. Un
   défilement non provoqué par l'utilisateur (mise en page lente, `scrollIntoView`) le déclencherait.
2. **(B, test)** `openExperience` annonce attendre les puces de l'URL sans l'attendre (l. 117) ;
   `drawerOpen` est une lecture instantanée (l. 275). Aucun défaut démontré.

## Suite
- La trace de l'échec (artefact `front-rapports` du run) tranche A ou B en une lecture : classe de
  `.filter-drawer` (ouvert ou non) et événements `scroll`. `gh run download` est refusé par les
  garde-fous à tous les rôles, session principale comprise : demande à la session back.
- Sans trace : aucune correction ; relancer le job, surveiller la prochaine occurrence.
- Si A : ne fermer le panneau que sur un défilement provoqué par l'utilisateur (`wheel`,
  `touchmove`, clavier) ou comparer `scrollTop` à sa valeur à l'ouverture ; test inchangé.
- Vérification : `pnpm --filter @siteperso/web exec playwright test test/experience.e2e.ts
  --project=desktop-1280 --repeat-each=20 --workers=2`, unitaires du composant.
- Ne pas ajouter `retries` en CI sans décision de Julien (affaiblit l'oracle).
