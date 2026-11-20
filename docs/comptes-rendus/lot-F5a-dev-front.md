# Lot F5a : sections Profil, IA et Recommandations (dev-front)

Date : 20 novembre 2026. Branche `lot/F5a-sections` (worktree `.claude/worktrees/lot-F5a-sections`), depuis develop
(b3ca884). Isolation : `.env` racine `COMPOSE_PROJECT_NAME=siteperso-v3-f5a`, ports 5932 à 5935.
Périmètre écrit respecté : `app/components/{profile,ai,recommendations}/`, `i18n/locales/{fr,en}/{profile,ai,recommendations}.json`,
ce compte rendu. Rien dans `components/home/`, `components/shell/`, `components/base/`, `data/`, `domain/`, `pages/`, `assets/css/`,
`common.json`, configurations. Aucun test existant modifié.

## Fait

| Ticket | Livré |
|---|---|
| F5-A Profil | `ProfileSection` (compose tout), `ProfileTitle` (« Développeur / full-stack » sur deux lignes + `SeniorBadge`), `SituationCard` (« en ce moment » + « ce que je recherche » en `dl` format / lieu / disponibilité), `SocialLinks` (GitHub néon puis LinkedIn bleu, chacun masqué si le lien manque, navigation masquée sans aucun lien) |
| F5-A IA | `AiSection` : titre, bloc « dans le produit » (étiquette + liste), bloc « au quotidien » (étiquette + texte), mots-clés en puces neutres non interactives |
| F5-A Recommandations | `RecommendationsSection` : lien discret bleu en haut (externe, `noopener noreferrer`), une `figure` / `blockquote` par recommandation avec `lang` = `RecommendationView.lang` (citation et légende), bouton « Voir sur LinkedIn » après la dernière, état vide |
| Libellés | `profile.json`, `ai.json`, `recommendations.json`, fr et en, mêmes clés (les clés `recommendations.provisional.*` de F3a sont conservées : `HomePage` les utilise encore) |

Preuves :
- Tests : 12 fichiers, `*.spec.ts` à côté du code (comportement, ARIA, clavier sans objet : aucun contrôle propre aux sections hors liens, deux langues), dont un `axe.spec.ts` par section (axe-core WCAG 2.2 A/AA sur la section montée seule, avec témoin qui prouve que l'outil détecte une violation ; cas : titre en `div` ou `h1`, GitHub absent, état vide, source absente, citations en `fr` et `en`, page `/en`).
- `pnpm --filter @siteperso/web lint typecheck test:coverage` : zéro avertissement, 811 tests, couverture 100 % sur les quatre métriques (847/847, 481/481, 258/258, 757/757).
- Vérification en vrai Chromium (conteneur Playwright du lot, serveur de développement, fixtures, page de démonstration TEMPORAIRE supprimée avant commit) : les trois sections dans `AppShell`, mobile 390 px (onglets Profil, Recos, IA), bureau 1280 px (sections ensemble), thèmes sombre et clair, `/` et `/en` : axe WCAG 2.2 AA, règles de contraste et de cible incluses, **0 violation** hors `document-title` (la page de démonstration n'avait pas de titre). Captures comparées aux références `mobile-390_profil_sombre`, `recos_sombre`, `ia_clair` : même rythme, mêmes tailles, mêmes couleurs ; écarts listés dans les décisions.

## Non fait

- **Parcours Playwright `test/{profile,ai,recommendations}.e2e.ts`** : un parcours ne voit ces sections que dans la vraie page, donc après l'intégration dans `HomePage` (interdit ici). Un fichier commité maintenant échouerait dans `pnpm check`. À écrire par la qa-front ou par le lead après intégration : axe sur les sections déjà couvert par `shell.e2e.ts` (qui contrôle la page entière), à ajouter : `lang="fr"` des citations sur `/en`, lien du haut et bouton du bas externes avec `rel="noopener noreferrer"`, absence du bouton GitHub avec les fixtures.
- Aucun fichier `domain/` ni composable : les sections ne portent aucune logique à décider (le mapping, le découpage du titre et les dates sont faits par `mapCv`) ni état à relier. Donc pas de mutation Stryker à passer pour ce lot.
- `FitToHeight` / facteur S : relève de la mosaïque (F6), non fait comme demandé.
- Le morceau du titre de la section IA en accent (« et au quotidien », maquette) : `AiView.title` est une seule chaîne ; non reproduit (voir points ouverts). Idem la boîte pointillée « [À COMPLÉTER] » de la maquette : un gabarit de travail, absent des données.

## API de chaque section (import explicite, comme `HomePage` le fait)

| Composant | Props | Morceau de `CvView` |
|---|---|---|
| `components/profile/ProfileSection.vue` | `profile: ProfileView`, `links: LinksView`, `titleTag?: 'h1' \| 'div'` (défaut `div`) | `view.profile`, `view.links` |
| `components/ai/AiSection.vue` | `ai: AiView` (non nul) | `view.ai` (le parent fait `v-if="view.ai"`) |
| `components/recommendations/RecommendationsSection.vue` | `recommendations: readonly RecommendationView[]`, `source: LinkView \| null` | `view.recommendations`, `view.links.linkedinRecommendations` |

Sous-composants du profil réutilisables : `ProfileTitle` (`lines`, `badge`, `tag`), `SituationCard` (`currently`, `lookingFor`), `SocialLinks` (`github`, `linkedin`).

Aucun des trois n'impose de hauteur, de défilement ni de remplissage : la tuile (Tile, F6) ou la colonne mobile de la coquille posent le cadre et le rembourrage. IA et Recommandations se centrent en `max-width: var(--content-max)` (820 px), comme la maquette.

## Notice d'intégration pour le lead (`HomePage`)

Remplacer le contenu provisoire de chaque slot d'`AppShell` (ordre inchangé : `profile`, `experience`, `recommendations`, `ai`) :

```vue
<template #profile>
  <ProfileSection :profile="view.profile" :links="view.links" />
</template>
<template #recommendations>
  <RecommendationsSection
    :recommendations="view.recommendations"
    :source="view.links.linkedinRecommendations"
  />
</template>
<template #ai>
  <AiSection v-if="view.ai" :ai="view.ai" />
</template>
```

Niveaux de titre (hiérarchie finale `h1` > `h2` de la coquille > `h3` > `h4`) :
- `AppShell` pose le `h2` de chaque section (`shell.headings.*`) : les sections n'en posent aucun. Profil : deux `h3` (« en ce moment », « ce que je recherche »). IA : un `h3` (titre) et deux `h4` (étiquettes des blocs, qui nomment la liste et le paragraphe). Recommandations : aucun titre (le lien du haut et les citations suivent le `h2`).
- **`h1` en double** : `AppShell` pose déjà le `h1` (`heading`, « Développeur full-stack », visible sur le bureau et dans l'onglet Profil), et `ProfileTitle` affiche le même texte en grand avec la pastille (capture de référence, mobile : le grand titre est celui du profil). Vérifié en navigateur : sans arbitrage, le titre apparaît deux fois. Deux options pour le lead : (a) garder `titleTag="div"` (défaut) et rendre le `h1` de la coquille masqué visuellement (`.visually-hidden`) : un seul titre visible, un seul `h1` ; un lecteur d'écran lit le titre une fois en `h1` puis « Développeur full-stack senior » dans la section ; (b) ajouter un slot `heading` à `AppShell` et y poser `<ProfileTitle tag="h1" …>`, puis passer `ProfileSection` sans titre (ajouter alors une prop `hideTitle` : à demander). Je recommande (a), sans changement de mes composants.
- Les clés `recommendations.provisional.count` et `experience.provisional.count` deviennent inutiles après l'intégration : à retirer par le lead, ou par moi sur demande pour `recommendations.json`.

## Décisions

- **Sous-blocs en `h3`/`h4`, pas de `h2`** : la coquille a déjà le `h2` de la section ; la maquette met un `h2` au titre de l'IA et au titre de chaque bloc du profil parce qu'elle n'a pas de `h2` de section. Même niveau relatif conservé (un cran sous le `h2` de la coquille pour les titres de blocs, deux pour les étiquettes de l'IA).
- **Mots-clés de l'IA = liste de puces neutres (`ul`/`li`, `aria-label`), pas des `TechChip`** : rien ne se clique ; un `TechChip` non interactif est le pointillé « sans expérience » du filtre. Bordure `--line` (décorative, non un contrôle, D12).
- **`lang` sur `blockquote` et sur `figcaption`** (donc sur auteur, rôle et contexte, qui sont dans la langue de la recommandation), pas sur `figure` : sélecteurs précis pour les tests de navigateur.
- **Lien du haut = `LinkButton variant="link" tone="linkedin"`** (libellé de l'API, dans la langue de la page) ; **bouton du bas = `LinkButton variant="linkedin" size="lg" block`** (libellé d'interface `recommendations.seeOnLinkedIn`). Sans adresse (`source` nul) : ni lien ni bouton. En état vide, le lien du haut reste, le bouton du bas disparaît (« après la dernière recommandation »).
- **`white-space: nowrap` de la maquette retiré** (accroches, lignes du titre) : il ferait déborder à 130 % de taille de texte (WCAG 1.4.10, reflux) ; la seconde ligne du titre passe à la ligne si la pastille ne tient pas.
- **Tailles par jalons de la coquille** : titre du profil 46 / 60 / 40 / 50 px (mobile, tablette, portable, desktop = tokens `--font-size-h1-*` et mêmes seuils de requête que `AppShell`) ; texte courant 17-18 px sous 1024 px et 15-17 px au-delà, comme les maquettes mobile et desktop.
- **Cibles** : les liens du profil ont 56 px sous 1024 px (maquette), 52 px au-delà ; le lien du haut des recommandations 44 px sous 1024 px (variante `link` de F1b), 32 px au-delà (maquette).
- **`useId`** (Vue) pour relier étiquettes et groupes (`aria-labelledby`) : identifiants stables serveur / client, distincts pour plusieurs instances d'une même page (testé).
- Contrainte constatée pour les tests : les imports `.vue` sont de type « erreur » pour ESLint typé, donc les spécifications d'axe passent le composant à monter par une fonction de rendu (`() => h(Section, props)`) plutôt que par un paramètre `Component`.

## Points ouverts

1. **Doublon du `h1`** (voir la notice) : arbitrage du lead.
2. **Titre de l'IA en deux couleurs** : la maquette colore « et au quotidien » en accent ; `AiView.title` est une seule chaîne (« L'IA, dans le produit et au quotidien »). Pour le reproduire il faudrait que le contrat (ou `mapAi`) fournisse le titre en deux parties ; à décider avec la session back/F4, sinon le titre reste d'une seule couleur (écart mineur, accessible).
3. **Taille 22 px du titre de l'IA sur le bureau** (maquette) : aucun token `--font-size-*` ne correspond ; valeur écrite `1.375rem` dans `AiSection.vue`. Demande de token partagé : `--font-size-h3-tile: 1.375rem` (lead-architecte), à adopter ensuite.
4. **Padding haut des onglets IA et Recos** : la maquette met 28 px au-dessus du contenu (20 px pour le Profil) ; `AppShell` donne 20 px partout. Écart de 8 px sur ces deux onglets, du ressort de la coquille.
5. **Noms réels dans les fixtures de recommandations** (auteurs, entreprise) : hors périmètre (F4, D20), mentionné pour la relecture sécurité ; mes tests n'utilisent que des textes fictifs.
6. **Accord des auteurs** (SPEC § 7) avant publication des citations : non technique, à suivre.

## Vérifications

- `pnpm --filter @siteperso/web lint typecheck test:coverage` : voir ci-dessus.
- `pnpm format` ; `pnpm integrity develop` ; `TURBO_FORCE=true pnpm check` : résultat consigné dans le message final (journal `f5a-check.log`, non commité).
- `pnpm db:down` en fin de lot ; serveur de développement arrêté ; page de démonstration supprimée ; arbre propre.
