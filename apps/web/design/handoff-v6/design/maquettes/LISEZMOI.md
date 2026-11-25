# Sources des maquettes v6

Les 7 artboards de la section **B v6 · review finale** du canvas, une par taille d'écran :

| Fichier | Taille | Mise en page |
|---|---|---|
| `B-v6-mobile.dc.html` | 390×844 | onglets en bas, barre d'actions masquable au défilement |
| `B-v6-tablette.dc.html` | 834×1112 | même logique que le mobile, plus large |
| `B-v6-portable.dc.html` | 1024×768 | 2 colonnes : profil 360 px à gauche, tuiles à droite |
| `B-v6-desktop.dc.html` | 1280×844 | mosaïque, agrandissement d'une tuile |
| `B-v6-grand.dc.html` | 1440×900 | mosaïque à la largeur maximale |
| `B-v6-fullhd.dc.html` | 1920×1080 | contenu plafonné à 1440 px, marges qui s'étirent |
| `B-v6-ultra.dc.html` | 3440×1440 | idem, contrôle du plafond |

**C'est une référence, pas du code à importer.** Ces fichiers sont écrits pour le canvas Claude
(balisage `<x-dc>`, `{{trous}}`, `<sc-if>`/`<sc-for>`, classe `DCLogic`) et ne tournent pas hors de
ce canvas. On y retrouve :

- les styles exacts de chaque élément (attributs `style` inline) ;
- la logique de mise en page des tuiles dans `renderVals()` (largeurs, empilement, agrandissement) ;
- l'ajustement du profil sans défilement dans `measureTiles()` (recherche dichotomique de l'échelle) ;
- la logique du filtre XP (ET strict, compteurs, suggestions, clavier).

La spécification qui fait foi est `SPEC.md`, à la racine. En cas d'écart, la spec gagne.
