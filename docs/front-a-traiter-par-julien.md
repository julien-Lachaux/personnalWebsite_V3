# Front V3 : ce que Julien traitera à la fin du développement

Liste tenue par la session front. Ce sont des sujets volontairement laissés de côté pendant le
développement (décision de Julien du 20 novembre 2026) ; chacun a un comportement provisoire qui ne
bloque pas les lots. Julien retire une ligne quand il l'a traitée.

| Sujet | Ce qu'il faut de Julien | Comportement provisoire |
|---|---|---|
| CV en anglais | Traduire le CV et fournir `cv-en.pdf` ; le CV français actuel est lui-même une version temporaire | La version anglaise du site pointe vers le PDF français (mention « in French ») tant que `cv-en.pdf` n'existe pas |
| Traductions EN du contenu | Relire `docs/traductions-a-relire.md` et retirer les lignes validées | Traductions proposées par les agents, servies telles quelles |
| Section IA, bloc « au quotidien » | Rédiger outils utilisés, méthode de travail, exemples concrets | Seul le texte actuel du handoff est affiché |
| Lien GitHub | Fournir l'URL du profil GitHub | Bouton GitHub masqué |
| Déclaration d'accessibilité | Valider le contenu de la page ; statut de conformité RGAA après audit | Page provisoire `/accessibilite`, statut « à compléter après audit » |
| Retouches visuelles | Comparer le site aux maquettes et lister les écarts | Rendu de la V1 ; captures de référence protégées dans `apps/web/design/handoff-v6/` |
| Contact évolué | Décider de la fonctionnalité qui remplacera le `mailto:` | Bouton « Lancer l'entretien » = `mailto:` |
| Cinquième entrée de navigation | Décider de son contenu | Non affichée |

Lot d'optimisation (F11, `docs/05-front-organisation.md`) : planifié en fin de chantier, ne demande
rien à Julien.
