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

## Correction F6b-D28 (22 nov. 2026)

Décision de Julien : le placeholder de la section IA n'affiche que le mot « placeholder » (identique en
fr et en), en attendant le vrai contenu. Le cadre terminal, le curseur (`--dur-cursor-blink`) et le picto
décoratif (`aria-hidden`) restent.

- `AiPlaceholder.vue` : une seule ligne `.ai-placeholder__line` (texte réel + curseur `aria-hidden`) ;
  l'invite `$`, la commande, la réponse et l'indice sont retirés, avec leurs styles.
- `i18n/locales/{fr,en}/ai.json` : `ai.placeholder.text` = « placeholder » ; `command`, `output`, `hint`
  supprimés. `i18n-messages.spec.ts` ne compare que les clés : un libellé identique passe, aucune
  exception à ajouter.
- Tests (autorisation 3d751685, `Justification-test: F6b-D28`), avant -> après :
  - `AiPlaceholder.spec.ts` : lignes attendues `['$ cat ia.md', 'ia.md : en cours d'écriture…', 'Le contenu
    arrive…']` (fr) et `[…ai.md…]` (en) -> `['placeholder']` dans les deux langues. Éléments
    `aria-hidden` : `span, span, svg` -> `span, svg` (l'invite n'existe plus) ; assertion sur
    `.ai-placeholder__prompt` retirée. Non interactif, ni `p`/titre, ni rôle : inchangés.
  - `HomePage-ai-placeholder.spec.ts` : `__command` « cat ia.md » / « cat ai.md » et textes « en cours
    d'écriture » / « still being written » -> `.ai-placeholder__line` = « placeholder » (fr, en, onglet
    mobile) ; titres des deux tests reformulés. Rendu quand `ai` est nul, absence de contenu IA : inchangés.
  - `HomePage.spec.ts` : test renommé « sans section IA, la section n'a aucun paragraphe de contenu et
    garde son titre » ; assertions inchangées.
  - `axe-placeholder.spec.ts` : aucun changement nécessaire (ne lit aucun texte) ; il passe sur le
    nouveau rendu.

### Liste des libellés identiques (autorisation d520207c)

`i18n-hardcoded.spec.ts` échouait (1099 verts sur 1100) : `ai.placeholder.text => "placeholder"` absent de
`SAME_IN_BOTH`. Avant : échec, reçu = attendu + cette entrée. Après : l'entrée
`['ai.placeholder.text', 'placeholder']` est ajoutée (mot décidé par Julien, D28), rien d'autre ;
`test:coverage` : 115 fichiers, 1100 tests verts, 100 %.
