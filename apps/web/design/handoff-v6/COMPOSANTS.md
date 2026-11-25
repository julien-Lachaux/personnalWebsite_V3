# Liste des composants — site perso V3

Découpage proposé à partir des maquettes v6. Les noms sont indicatifs.

## Structure

| Composant | Rôle | Notes |
|---|---|---|
| `AppShell` | racine : thème, réglages d'accessibilité (`data-*`), lien d'évitement, mise en page selon la taille | expose le contexte thème / accessibilité |
| `TopBar` (desktop) | nom, vue d'ensemble, onglets, Lancer l'entretien, CV PDF, accessibilité, FR, thème | contenu aligné sur la zone de 1440 px |
| `MobileHeader` | `>_ julien-lachaux/<fichier>`, accessibilité, FR, thème | fichier selon l'onglet actif |
| `BottomNav` | 4 onglets avec icône + libellé | `aria-current`, glissement entre sections |
| `ActionBar` | Lancer l'entretien + CV PDF (mobile, tablette) | masquable au défilement |
| `ScrollHint` | flèche « faire défiler » | apparaît si du contenu reste caché |

## Mosaïque (portable et plus)

| Composant | Rôle | Notes |
|---|---|---|
| `TileGrid` | calcule les positions (mosaïque, agrandie, colonne latérale, empilement, poussée) | logique pure dans un service testable, animation en CSS |
| `Tile` | fenêtre : barre de titre lilas (`>_ fichier`), bouton agrandir/réduire, corps | `aria-hidden` / `inert` quand elle est sortie |
| `FitToHeight` | réduit le Profil sans défilement (facteur `S`, élargissement + `scale`) | mesure sur clone, cache par (largeur, hauteur) |

## Sections

| Composant | Contenu |
|---|---|
| `ProfileSection` | `ProfileTitle` (Développeur / full-stack + `SeniorBadge`), accroches, mission, intro, `SituationCard`, `SocialLinks` |
| `SituationCard` | « en ce moment » + « ce que je recherche » (liste de définitions format / lieu / disponibilité) |
| `ExperienceSection` | `TechFilter` + liste de `ExperienceCard` + groupes de résultats |
| `ExperienceCard` | intitulé, organisation, période, lieu, résumé, `Accordion` détail, `TechChip` × n |
| `RecommendationsSection` | `SourceLink`, `Recommendation` × 3, `LinkedInButton` |
| `Recommendation` | citation (`blockquote`), auteur, rôle, contexte |
| `AiSection` | blocs « dans le produit » et « au quotidien » |

## Filtre

| Composant | Rôle |
|---|---|
| `TechFilter` | zone fixe : étiquette + `ChipInput` + `FilterDrawer` + région `aria-live` |
| `ChipInput` | champ avec les puces choisies, saisie, raccourcis (Entrée, Échap, Retour arrière) |
| `SuggestionList` | 6 suggestions max avec compteur ; message si aucun résultat |
| `FilterDrawer` | panneau animé : « stack principale » + `AllTechs` + Fermer |
| `AllTechs` | technos par domaine, compteurs dynamiques, état désactivé, pointillé si sans XP |
| `ResultGroups` | titres de groupe, « Voir / Masquer les N autres », état vide |

## Éléments de base

| Composant | Notes |
|---|---|
| `TechChip` | puce : neutre au repos, néon au survol et quand active ; `aria-pressed`, `aria-disabled` |
| `SeniorBadge` | pastille néon (sombre) ou pleine (clair) |
| `Accordion` | `aria-expanded` / `aria-controls`, animation `grid-template-rows` |
| `Switch` | `button role="switch" aria-checked` |
| `SegmentedControl` | taille du texte, boutons `aria-pressed` |
| `Button` / `LinkButton` | variantes : plein accent, contour, bleu LinkedIn, néon GitHub, lien texte |
| `Window` (modale) | barre de titre `>_ fichier`, ×, piège de focus, Échap, voile, retour du focus |
| `Popover` (non modal) | pour le panneau d'accessibilité |

## Fenêtres

| Composant | Notes |
|---|---|
| `ContactWindow` (`contact.sh`) | formulaire nom, structure, e-mail, message ; honeypot ; états envoi / succès / erreur à dessiner |
| `AccessibilityPanel` (`accessibilite.cfg`) | taille du texte, 5 interrupteurs, Réinitialiser, lien vers la déclaration |
| `EasterEggWindow` (`huile-de-coude.sh`) | lignes animées, barre de progression, Retour au CV |

## Services (logique pure, tests unitaires)

| Service | Responsabilité |
|---|---|
| `filterService` | correspondance techno ↔ XP (avec mots-clés), filtre ET, compteurs, suggestions, groupes de résultats |
| `layoutService` | géométrie des tuiles selon l'état (mosaïque, agrandie, colonne latérale, empilement, poussée) et la taille de la zone |
| `fitService` | calcul du facteur `S` à partir d'une fonction de mesure injectée |
| `preferencesService` | thème et réglages d'accessibilité : lecture des préférences système, localStorage |
| `contentService` (back) | exposition des données de `site-content.json` |
| `contactService` (back) | validation, honeypot, limite de débit, envoi |

## États non dessinés à prévoir
- Formulaire d'entretien : envoi en cours, succès, erreur, erreurs de champ.
- Chargement des données (squelettes) et erreur d'API.
- Version anglaise (si le bouton FR est conservé).
- Page « Déclaration d'accessibilité » et page 404.
