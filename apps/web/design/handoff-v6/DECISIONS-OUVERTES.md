# Décisions ouvertes et contenu provisoire

## Décisions à prendre

| Sujet | Options | Remarque |
|---|---|---|
| Framework front | Nuxt (Vue 3) ou autre | Nuxt colle au profil et au projet d'hébergement VPS |
| Rendu | SSR, statique (SSG) ou hybride | le contenu change peu : du statique avec une API pour le contact peut suffire |
| Styles | CSS natif + variables (`tokens.css`), CSS Modules, UnoCSS / Tailwind | les tokens sont déjà au format variables CSS |
| Backend | NestJS d'abord, puis réécriture en Rust (prévu) | définir le contrat d'API dès la V1 pour faciliter la migration |
| Source des données | base de la V2 (alimentée à partir de `site-content.json`) ou fichiers de contenu versionnés | la base n'est utile que s'il faut éditer sans redéployer |
| Envoi du formulaire | SMTP, service d'e-mail transactionnel, ou stockage + notification | gérer les données personnelles (durée de conservation, mention RGPD) |
| Langues | français seul ou français + anglais | le bouton FR suppose une version anglaise |
| Persistance des préférences | localStorage seul, ou aussi un cookie pour le rendu serveur du thème | un cookie évite le flash de thème au chargement en SSR |
| Polices | Google Fonts ou auto-hébergées | l'auto-hébergement simplifie la CSP et la conformité RGPD |
| Statistiques de visite | aucune, Plausible, ou une alternative auto-hébergée | sans cookie de préférence |
| Cinquième entrée de navigation | réservée | à définir plus tard |
| Version du référentiel pour l'audit | RGAA 4.1.2 ou RGAA 5 (publication prévue fin 2026) | dépend de la date de mise en ligne |

## Contenu provisoire à remplacer

| Élément | Valeur actuelle | Où |
|---|---|---|
| URL GitHub | `#github` / `[À COMPLÉTER : URL GitHub]` | Profil, bouton GitHub |
| PDF du CV | `#cv` / `[À COMPLÉTER : URL du CV PDF]` | bouton CV PDF |
| Section IA : outils, méthode, exemples | `[À COMPLÉTER : outils utilisés, méthode de travail, exemples concrets]` | IA, bloc « au quotidien » |
| Page « Déclaration d'accessibilité » | `#accessibilite` | panneau d'accessibilité |
| Statut de conformité RGAA | `[à compléter après audit]` | panneau d'accessibilité |
| Délai de réponse au formulaire | « sous 48 h ouvrées » (à confirmer) | fenêtre Lancer l'entretien |
| Version anglaise des contenus | absente | tout le site, si on garde FR / EN |
| Accord des auteurs des recommandations | à obtenir | section Recos (textes repris tels quels de LinkedIn, coquilles comprises) |

## Points d'attention hérités des maquettes
- Les compteurs de technos viennent des stacks du CV. Certains paraissent bas (TypeScript 2 XP, Node.js 1 XP) : compléter les stacks si besoin, sinon le filtre sous-représente ces technos.
- Agrandissement du texte : la maquette utilise `zoom`. Dans le code, passer toutes les tailles en `rem`.
- La réduction automatique du Profil (facteur `S`) dépend des polices chargées : relancer la mesure après `document.fonts.ready`.
