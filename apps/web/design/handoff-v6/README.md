# Passage au code — site perso V3

Dossier de passage des maquettes (canvas « Site perso V3 — Mosaïque », section **B v6 · review finale**) vers le projet de code.

| Fichier | Contenu |
|---|---|
| `SPEC.md` | spécification fonctionnelle et d'interface : mises en page, tuiles, filtre, fenêtres, thèmes, accessibilité, sécurité, tests |
| `design-tokens.json` | toutes les valeurs : couleurs par thème et en contraste renforcé, typo, espacements, tailles, animations, points de rupture |
| `tokens.css` | les mêmes couleurs et constantes en variables CSS, prêtes à importer |
| `data/site-content.json` | contenu : profil, 8 expériences, technos par domaine, stack principale, recommandations, IA, formulaire, easter egg, réglages d'accessibilité |
| `COMPOSANTS.md` | découpage en composants et services, états non dessinés |
| `DECISIONS-OUVERTES.md` | décisions à prendre et contenu provisoire à remplacer |
| `design/reference/` | 48 captures PNG : 7 tailles d'écran, 2 thèmes, états clés (tiroir du filtre, contact, accessibilité, contraste…) |
| `design/maquettes/` | les 7 sources `.dc.html` de la v6, en référence (ne s'importent pas telles quelles) |

Les valeurs `[À COMPLÉTER …]` dans les données signalent le contenu provisoire.

Ordre de lecture conseillé : `SPEC.md`, puis les captures de `design/reference/`, puis `COMPOSANTS.md`. Les sources de `design/maquettes/` servent à vérifier un style ou un comportement précis.
