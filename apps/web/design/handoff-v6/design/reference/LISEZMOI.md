# Captures de référence

48 captures PNG des maquettes v6, à comparer avec l'implémentation (tests de régression visuelle
possibles avec Playwright `toHaveScreenshot`).

Nom des fichiers : `<écran>-<largeur>_<état>_<thème>.png`.

- **Toutes les tailles desktop** (portable 1024, desktop 1280, grand 1440, fullhd 1920, ultra 3440) :
  mosaïque sombre et clair, profil agrandi, XP agrandie.
- **Desktop 1280, états** : IA et recos agrandies, filtre XP avec tiroir ouvert, filtre sans résultat,
  fenêtre contact, menu accessibilité, easter egg, contraste renforcé.
- **Mobile 390** : les 4 onglets dans les 2 thèmes, tiroir du filtre, filtres actifs, contact,
  accessibilité, easter egg, contraste renforcé.
- **Tablette 834** : les 4 onglets en sombre, profil et tiroir du filtre en clair.

Limites : rendu local (Chromium headless), pas le viewer du canvas. Les polices Space Grotesk et
JetBrains Mono sont chargées ; Atkinson Hyperlegible ne l'est pas. Les animations et le survol ne
sont pas représentés. Une seule position de défilement (en haut).
