# Site perso V3 — Spécification fonctionnelle et d'interface

Référence visuelle : canvas « Site perso V3 — Mosaïque », section **B v6 · review finale** (mobile 390, tablette 834, petit portable 1024, desktop 1280, grand écran 1440, Full HD 1920, écran 3440).
Les maquettes sont la référence de rendu et de comportement, pas du code à reprendre (styles en ligne, zoom de maquette, format propre au canvas).

Fichiers associés : `design-tokens.json` / `tokens.css` (valeurs), `data/site-content.json` (contenu), `COMPOSANTS.md`, `DECISIONS-OUVERTES.md`.

---

## 1. Principes

- **Mobile first**, responsive obligatoire.
- **Identité « terminal / fenêtres »** reprise du CV PDF : barres de titre lilas avec nom de fichier (`profil.cv`, `experience.log`…), ombre verte décalée, deux polices (Space Grotesk pour le contenu, JetBrains Mono pour les données et méta).
- **Cible** : associations, ONG, ESS, service public. Vocabulaire explicite, peu de jargon.
- **Deux thèmes au même caractère** (sombre et clair), basculables, qui suivent le système au premier chargement.
- **Accessibilité** : viser WCAG 2.2 AA / RGAA (version en vigueur au moment de l'audit).

## 2. Contenu et navigation

Quatre sections : **Profil**, **XP**, **Recos**, **IA**. La section Skills n'existe plus : les technos vivent dans le filtre de XP. Une cinquième entrée de navigation est réservée pour plus tard.

| Section | Fichier affiché | Contenu |
|---|---|---|
| Profil | `profil.cv` | titre, accroches, mission, intro, encadré « en ce moment » + « ce que je recherche », liens GitHub / LinkedIn |
| XP | `experience.log` | filtre par techno + 8 expériences en accordéon |
| Recos | `recommandations.md` | lien source LinkedIn en haut, 3 recommandations, bouton « Voir sur LinkedIn » en bas |
| IA | `ia.md` | « dans le produit » + « au quotidien » |

Actions permanentes : **Lancer l'entretien** (ouvre `contact.sh`) et **CV PDF**.
En-tête : bouton accessibilité, langue (FR), thème.

## 3. Mise en page par taille d'écran

### 3.1 Mobile (< 768 px)
- En-tête 52,5 px (valeur entière avec la bordure 1,5 px pour éviter les artefacts de demi-pixel) : `>_ julien-lachaux/<fichier de l'onglet>` (préfixe gris, fichier en gras, ellipse si trop long), puis accessibilité, FR, thème.
- Pas de gros titre de section visible : un `<h2>` masqué visuellement par section pour les lecteurs d'écran.
- Une section plein écran à la fois. Glissement horizontal entre onglets (64 px, sens selon l'ordre des onglets).
- Barre d'actions (66 px) au-dessus de la navigation du bas (64 px, 4 onglets).
  - Elle se masque au défilement vers le bas (seuil 24 px) et revient au défilement vers le haut ou au changement d'onglet.
  - Verrou de 360 ms après chaque bascule, pour éviter l'oscillation en bas de page.
- Flèche « faire défiler » à 12 px au-dessus de la barre d'actions, uniquement si du contenu reste caché.

### 3.2 Tablette (768–1023 px)
- Même structure que le mobile, contenu centré sur une colonne de 640 px (`max(32px, (100% - 640px) / 2)` de marge).
- Titre du profil à 60 px. Fenêtres (entretien, easter egg) centrées en 560 px.

### 3.3 Petit portable (1024–1199 px) — mosaïque 2 colonnes
- Profil à gauche, 360 px, toute la hauteur.
- XP en haut à droite (56 % de la hauteur).
- IA et Recos côte à côte en dessous (44 %).

### 3.4 Desktop (≥ 1200 px) — mosaïque 3 colonnes
- Colonnes : Profil 420 px, XP (100% − 848 px), colonne droite 380 px avec IA puis Recos (une demi-hauteur chacune).
- Marges et gouttières : 12 px.

### 3.5 Grands écrans (> 1440 px)
- La zone des tuiles est limitée à **1440 px**, centrée. Seuls le fond et les bords vides de la barre du haut s'étirent.
- Le contenu de la barre du haut s'aligne sur les bords de cette zone.

## 4. Tuiles (desktop et portable)

### 4.1 Hauteur du Profil
- Profil s'arrête à la hauteur de son contenu sur les écrans hauts (pas de vide interne) ; sinon il prend toute la hauteur.
- **Profil ne défile jamais dans la mosaïque.** Si le contenu dépasse, il est réduit d'un facteur `S` (entre 0,6 et 1) :
  - le contenu est élargi à `largeur / S`, puis mis à l'échelle `scale(S)` depuis le coin haut gauche ;
  - il occupe donc toute la colonne, et les lignes se recomposent normalement ;
  - `S` est calculé par recherche dichotomique sur un clone hors écran, pour chaque couple (largeur de tuile, hauteur disponible). Le résultat est mis en cache et le cache est invalidé quand le contenu change.
- Quand Profil est dans la colonne latérale (une autre tuile agrandie) : taille normale (S = 1) et défilement, comme les tuiles voisines.
- Si l'utilisateur agrandit le texte (réglage d'accessibilité), la réduction est désactivée et le Profil défile.

### 4.2 Agrandir une tuile
Bouton dans la barre de titre, ou onglet de la barre du haut. Le bouton « vue d'ensemble » revient à la mosaïque.

- **Taille de la tuile agrandie :**
  - largeur `min(largeur dispo, 868 px)` : contenu de 820 px max + 2 × 24 px ;
  - hauteur : la hauteur de son contenu pour Profil, IA et Recos ; toute la hauteur pour XP.
- **Colonne latérale :** si la place restante à droite fait au moins 340 px, la tuile agrandie se place à gauche et les autres s'empilent à droite, à parts égales en hauteur.
- **Pas de place à côté** (petit portable) : la tuile agrandie est centrée, et les autres sont poussées hors de la zone, à gauche, à droite ou en bas selon leur position.
- **Empilement Profil + IA :** si on agrandit Profil (ou IA) et que les deux tiennent en entier l'un sous l'autre, l'autre vient dessous, à la même largeur. Les tuiles restantes passent dans la colonne latérale.
- **Animation :**
  - position, taille et facteur `S` du Profil animés ensemble : 550 ms, `cubic-bezier(.4, 0, .15, 1)` ;
  - `visibility: hidden` différé de 550 ms sur les tuiles sorties ;
  - aucun recalcul visible après la fin de l'animation.
- Les hauteurs naturelles sont mesurées sur un clone hors écran (`ResizeObserver` sur la zone et sur les contenus, puis après `document.fonts.ready`).

## 5. Filtre des expériences (XP)

- **Un seul endroit pour filtrer :** la section XP. Pas de champ de recherche dans la barre principale.
- **Zone fixe en haut de XP**, hors de la zone qui défile, pour qu'aucun texte ne passe dessous :
  - étiquette « filtrer par techno » ;
  - champ contenant les technos choisies sous forme de puces (cliquer une puce la retire).
- **Panneau sous le champ**, ouvert au clic ou au focus clavier sur le champ (glissement + fondu, 280 ms) :
  - « stack principale » : TypeScript, Node.js, NestJS, Vue.js, PostgreSQL, Kafka, Docker ;
  - lien « Toutes les technos (25) », qui déplie toutes les technos par domaine ;
  - fermeture : bouton Fermer, Échap (champ vide), ou défilement de la liste ;
  - choisir une techno ne ferme pas le panneau ;
  - un focus programmatique (retour de focus après une action) n'ouvre pas le panneau.
- **Saisie :** suggestions (6 max) avec le nombre d'XP ; elles remplacent le panneau.
  - Entrée choisit la première suggestion valide ;
  - Retour arrière sur un champ vide retire la dernière puce.
- **Logique ET stricte :**
  - seules les XP qui ont toutes les technos choisies sont affichées, sous « Avec toutes ces technos · N » ;
  - les autres sont repliées derrière « Voir les N autres expériences », atténuées, avec « En partie : X » pour les correspondances partielles ;
  - aucune page vide : message « Aucune expérience ne combine toutes ces technos » + bouton pour voir les autres.
- **Compteurs dynamiques :** à côté de chaque techno, le nombre d'XP qui resteraient en l'ajoutant (ou le résultat courant si elle est déjà choisie).
  - Une techno qui donnerait 0 résultat est atténuée et désactivée (`aria-disabled`).
  - Les technos sans expérience détaillée sont en pointillé et non cliquables.
- **Badges des cartes XP :** ils activent ou désactivent le filtre, et apparaissent en néon au survol et quand ils sont actifs. Exception : « Huile de coude » ouvre l'easter egg.
- **Persistance :** les filtres survivent au changement d'onglet. Dans le code, les mettre dans l'URL (`?tech=kafka,typescript`) pour qu'ils soient partageables.
- **Annonce aux lecteurs d'écran :** région `aria-live` avec le nombre de résultats.
- **Recherche insensible à la casse.** Les mots-clés cachés `searchKeywords` (données) sont inclus dans la correspondance.

## 6. Carte d'expérience
- Ordre : intitulé du poste, organisation (accent, préfixée `@` ou `>`), période (violet, mono), lieu et contrat, résumé, détail en accordéon, puces de stack.
- Accordéon : chevron en haut à droite (44 × 44), `aria-expanded` / `aria-controls`, animation `grid-template-rows` 0fr → 1fr (320 ms).
- Séparateurs sous chaque carte (pas au-dessus), pour éviter le double trait sous la zone fixe.

## 7. Recommandations
- Lien discret en haut : « Recommandations publiées sur LinkedIn ↗ » (bleu LinkedIn).
- Bouton « Voir sur LinkedIn » en bas, après la dernière recommandation.
- Textes reproduits à l'identique de LinkedIn (coquilles comprises) : obtenir l'accord des auteurs avant publication.

## 8. Fenêtres
- **Lancer l'entretien (`contact.sh`)** : texte d'accroche, champs nom, structure (facultatif), e-mail, message, bouton Envoyer.
- **Accessibilité (`accessibilite.cfg`)** : voir § 10.
- **Easter egg (`huile-de-coude.sh`)** : lignes de terminal animées, bouton « Retour au CV ».
- **Comportement commun :**
  - piège de focus pour les fenêtres modales ;
  - Échap ferme la fenêtre ;
  - retour du focus sur le déclencheur ;
  - voile cliquable pour fermer (entretien et easter egg).

## 9. Thèmes
- `data-theme="sombre" | "clair"` sur la racine. Valeur initiale : `prefers-color-scheme`. Le choix est mémorisé (localStorage).
- Les deux thèmes ont le même caractère : barres lilas (claire en clair, lilas foncé en sombre) et ombre verte décalée.
- Rôles des couleurs (détail dans les tokens) :
  - vert accent : actions et liens ;
  - violet : méta (dates, titres de blocs) ;
  - néon : pastille senior et filtres ;
  - bleu : LinkedIn uniquement.

## 10. Accessibilité

### 10.1 Panneau d'accessibilité (en-tête, à côté de FR)
- Bouton avec `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`.
- Panneau non modal ; focus sur le premier réglage à l'ouverture ; Échap ou × ferme et rend le focus au bouton.
- Réglages, à mémoriser en localStorage :
  - **Taille du texte** : 100 %, 115 % ou 130 % (dans le code : changer la taille de base en `rem`, pas de `zoom`) ;
  - **Contraste renforcé** : palette `highContrast` des tokens ;
  - **Police plus lisible** : Atkinson Hyperlegible ;
  - **Espacement du texte** (WCAG 1.4.12) : interligne 1,5 ; lettres 0,12 em ; mots 0,16 em ;
  - **Souligner les liens** ;
  - **Réduire les animations** : activé par défaut si `prefers-reduced-motion`.
- Les interrupteurs sont des `button role="switch" aria-checked` ; la taille du texte est un groupe de boutons `aria-pressed`.
- Lien « Déclaration d'accessibilité » (page à créer) et mention du statut de conformité après audit.

### 10.2 Exigences générales
- Lien d'évitement « Aller au contenu » (visible au focus).
- Cibles tactiles d'au moins 44 px sur mobile et tablette.
- Focus visible : contour 2 px accent, décalé de 2 px.
- Contrastes ≥ 4,5:1 pour le texte, dans les deux thèmes et en contraste renforcé.
- Ne jamais utiliser `onClick` sur un `div` : uniquement de vrais `button`, `a`, `input` + `label`.
- Icônes : `aria-hidden` si décoratives, sinon nom accessible.
- `prefers-reduced-motion` respecté partout (glissements, tuiles, accordéons, panneau, barre d'actions, easter egg).
- Zones qui défilent atteignables au clavier (`tabindex="0"` + nom quand nécessaire).

## 11. Sécurité (côté code)
- Formulaire d'entretien :
  - validation et nettoyage côté serveur ;
  - limite de débit par IP ;
  - champ piège (honeypot) plutôt qu'un captcha ;
  - longueur maximale des champs ;
  - pas de rendu HTML du message.
- Liens externes en `rel="noopener noreferrer"`.
- Ne pas publier e-mail ni téléphone en clair ; nettoyer les métadonnées du PDF du CV.
- En-têtes de sécurité : CSP (polices Google ou auto-hébergées), HSTS, `X-Content-Type-Options`, `Referrer-Policy`.

## 12. Tests attendus
- **Unitaires (services)** :
  - calcul du filtre ET ;
  - compteurs dynamiques et désactivation à 0 ;
  - recherche de suggestions ;
  - calcul de mise en page des tuiles (agrandie, colonne latérale, empilement, poussée) ;
  - calcul du facteur `S` (avec une fonction de mesure simulée) ;
  - lecture et écriture des préférences (thème, accessibilité).
- **E2E (contrôleurs)** :
  - API de contenu (profil, expériences, technos, recommandations) ;
  - endpoint du formulaire d'entretien (validation, honeypot, limite de débit) ;
  - parcours navigateur : filtre avec URL, agrandir puis réduire, thème, panneau d'accessibilité au clavier.
- **Accessibilité automatisée :** axe-core dans les e2e, sur chaque section et dans les deux thèmes. À compléter par les tests manuels de l'audit.
