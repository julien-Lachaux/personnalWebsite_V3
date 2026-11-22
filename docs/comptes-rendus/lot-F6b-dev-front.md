# Lot F6b : placeholder de la section IA (D27), dev-front

Date : 22 novembre 2026. Branche `lot/F6b-ia-vide` (partie de `lot/F6-mosaique`).

## Fait

- `AiPlaceholder.vue` (`app/components/ai/`) : petit terminal (commande, réponse, mot de la fin, curseur
  qui clignote) et picto SVG en ligne (fichier et crayon, `currentColor` = `--violet`), non interactif.
  Texte réel lu par les lecteurs d'écran ; l'invite `$`, le curseur et le picto sont `aria-hidden`.
  Pas de `<p>` ni de titre (le `h2` « IA » est celui de la coquille). Couleurs, polices et tailles par
  tokens (`--violet-bg`, `--text`, `--muted`, `--accent`, `--font-mono`, `--font-size-*`, rem).
- Mouvement : le clignotement est une `animation` ; les filets de `base.css` (réglage « réduire les
  animations » et `prefers-reduced-motion`) la ramènent à une itération de 0,01 ms : le curseur reste
  affiché, fixe.
- `HomePage.vue` (exception nommée) : `<AiPlaceholder v-else />` après `<AiSection v-if="view.ai" …>` ;
  tuile (mosaïque) et onglet (mobile, tablette) ne sont plus jamais vides.
- Libellés `ai.placeholder.{command,output,hint}` dans `fr/ai.json` et `en/ai.json`.
- Tests ajoutés : `AiPlaceholder.spec.ts` (fr, en, `aria-hidden`, non interactif),
  `axe-placeholder.spec.ts` (axe, fr et en), `HomePage-ai-placeholder.spec.ts` (bureau fr et en, onglet IA
  mobile, contenu normal quand l'IA existe).

## Variantes de texte (Julien choisit)

| | Commande | Réponse | Mot de la fin |
|---|---|---|---|
| A (implémentée) fr | `cat ia.md` | `ia.md : en cours d’écriture…` | Le contenu arrive. Un assistant m’aide à le rédiger, mais je relis tout. |
| A en | `cat ai.md` | `ai.md: still being written…` | Content incoming. An assistant is helping me draft it, but I review everything. |
| B fr | `./ia --expliquer` | `Erreur : le modèle réfléchit encore.` | Réessayez dans un instant. |
| B en | `./ai --explain` | `Error: the model is still thinking.` | Try again in a moment. |
| C fr | `git log ia.md` | `fatal : aucun commit pour l’instant.` | La section IA a encore tout à prouver. |
| C en | `git log ai.md` | `fatal: no commits yet.` | The AI section still has everything to prove. |

A retenue : elle reprend l'exemple du ticket et fait le lien avec le sujet. Changer de variante = les trois
textes de `ai.placeholder` dans les deux `ai.json` (le test `AiPlaceholder.spec.ts` cite les textes).

## Non fait

- Captures (mobile 390 fr clair et sombre, tuile 1280) et parcours Playwright : Docker absent de WSL
  (consigne de l'orchestrateur). Pas de parcours écrit : les fixtures ont toutes une IA et la source
  `NUXT_CV_SOURCE=api` demande une API ; un parcours ciblé exigerait un `generate` dédié sans IA (à
  décider). Le contraste réel du placeholder dans les 4 palettes n'est donc pas vérifié en navigateur :
  axe (jsdom) ne mesure pas les contrastes. Texte `--muted` sur fond `--violet-bg` (8 % de violet sur le
  fond de tuile) : à contrôler aux captures ou par le parcours `shell.e2e.ts` avec une API sans IA.

## Décisions

- Pas de `<p>` : le test existant `HomePage.spec.ts` (« sans section IA, rien n'est affiché dans la
  section ») vérifie `findAll('p') == []` ; il reste vrai, mais son titre est désormais inexact (le
  placeholder s'affiche). Non modifié (test existant) : à renommer par le correcteur si besoin.
- Un espace réel entre `$` et la commande (copier-coller, lecture).

## Vérifications

- Lint (zéro avertissement), typecheck et `pnpm integrity develop` : verts.
- Vitest, projets unit et nuxt, `--maxWorkers=2`, couverture : 1045 tests verts, 100 % (instructions,
  branches, fonctions, lignes).
