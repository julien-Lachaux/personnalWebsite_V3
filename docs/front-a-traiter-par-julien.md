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
| Déclaration d'accessibilité | Valider le contenu de la page (`declaration.*` de `common.json`, lot F7 : engagement à la première personne, rubriques du modèle RGAA, date du 21 nov. 2026, voies de recours vers le Défenseur des droits) ; statut de conformité RGAA et liste des contenus non accessibles (`declaration.issues.items`) après audit | Page `/accessibilite` et `/en/accessibility` marquée « Version provisoire », état « non conforme » (règle du RGAA sans audit), aucun défaut recensé |
| Traductions EN de l'interface | Relire la liste « Traductions EN de l'interface » plus bas (libellés de `apps/web/i18n/locales/en/`) et retirer les lignes validées | Traductions proposées par les agents, servies telles quelles |
| Image de partage (Open Graph) | Fournir une image (1200 × 630 px conseillé) si le site doit en afficher une dans les aperçus de liens | Aucune `og:image` : titre, description, adresse et langue seulement |
| Adresse publique du site | Fixer `NUXT_PUBLIC_I18N_BASE_URL` au build de production (domaine définitif) | `http://localhost:3001` par défaut : liens canoniques, hreflang, `sitemap.xml` et `robots.txt` en dépendent |
| Retouches visuelles | Comparer le site aux maquettes et lister les écarts | Rendu de la V1 ; captures de référence protégées dans `apps/web/design/handoff-v6/` |
| Contact évolué | Décider de la fonctionnalité qui remplacera le `mailto:` | Bouton « Lancer l'entretien » = `mailto:` |
| Cinquième entrée de navigation | Décider de son contenu | Non affichée |

Lot d'optimisation (F11, `docs/05-front-organisation.md`) : planifié en fin de chantier, ne demande
rien à Julien.

## Traductions EN de l'interface (à relire)

Libellés d'interface proposés en anglais (fichiers `apps/web/i18n/locales/{fr,en}/<fichier>.json`),
relevés au lot F7 (21 nov. 2026). Les libellés identiques dans les deux langues (`XP`, `CV PDF`,
`Freelance`, `Sections`, `format`, `muscles`, `patience`, commande de l'easter egg) ne sont pas listés
(`app/i18n-hardcoded.spec.ts`). Julien corrige dans le fichier `en/` puis retire la ligne.

| Fichier | Clé | Texte FR | Texte EN proposé |
|---|---|---|---|
| common | `common.close` | Fermer | Close |
| common | `common.opensInNewTab` | s'ouvre dans un nouvel onglet | opens in a new tab |
| common | `common.expand` | Agrandir {name} | Expand {name} |
| common | `common.collapse` | Réduire {name} | Collapse {name} |
| common | `common.showDetails` | Voir le détail : {name} | Show details: {name} |
| common | `common.skipToContent` | Aller au contenu | Skip to content |
| common | `seo.description` | Site et CV de Julien Lachaux, développeur full-stack : expériences, technologies, recommandations et place de l’IA dans son travail. | Website and CV of Julien Lachaux, full-stack developer: experience, technologies, recommendations and the place of AI in his work. |
| common | `annex.home` | accueil | home page |
| common | `declaration.title` | Déclaration d’accessibilité | Accessibility statement |
| common | `declaration.description` | État de conformité du site aux règles d’accessibilité (WCAG 2.2 AA, RGAA), contenus non accessibles connus, contact et voies de recours. | How this website conforms to accessibility standards (WCAG 2.2 AA, RGAA), known inaccessible content, contact and how to seek redress. |
| common | `declaration.pending` | Version provisoire : la déclaration définitive sera publiée après l’audit du site. | Provisional version: the final statement will be published after the site audit. |
| common | `declaration.back` | Retour à l’accueil | Back to the home page |
| common | `declaration.intro` | Je m’engage à rendre ce site accessible à toutes et à tous, quels que soient le matériel, le logiciel et les capacités de chacun. Cette déclaration s’applique au site {site}. | I am committed to making this website accessible to everyone, whatever their hardware, software and abilities. This statement applies to the website {site}. |
| common | `declaration.status.title` | État de conformité | Compliance status |
| common | `declaration.status.text` | Ce site est {status} au RGAA : il n’a pas encore fait l’objet d’un audit de conformité. En l’absence de résultats d’audit en cours de validité, le RGAA demande de le déclarer non conforme ; aucun taux de conformité n’est donc publié. | This website is {status} with the RGAA: it has not yet been audited. Without valid audit results, the RGAA requires it to be declared non-compliant, so no compliance rate is published. |
| common | `declaration.status.value` | non conforme | non-compliant |
| common | `declaration.standard.title` | Référentiel visé | Target standard |
| common | `declaration.standard.text` | Le site vise le niveau AA des WCAG 2.2 (règles pour l’accessibilité des contenus web) et le RGAA (référentiel général d’amélioration de l’accessibilité), dans sa version 4.1.2 ou dans la version en vigueur à la date de l’audit. | The website aims for level AA of WCAG 2.2 (Web Content Accessibility Guidelines) and for the RGAA (the French general accessibility improvement framework), version 4.1.2 or the version in force on the date of the audit. |
| common | `declaration.technologies.title` | Technologies utilisées | Technologies used |
| common | `declaration.technologies.text` | Le site est réalisé en HTML5, CSS et JavaScript ; WAI-ARIA complète la sémantique des composants interactifs. | The website is built with HTML5, CSS and JavaScript; WAI-ARIA supplements the semantics of interactive components. |
| common | `declaration.tests.title` | Environnement de test | Test environment |
| common | `declaration.tests.text` | Pendant le développement, chaque page est vérifiée automatiquement avec axe-core (critères A et AA des WCAG 2.2) dans le navigateur Chromium, à sept largeurs d’écran de 390 à 3 440 pixels, dans les thèmes clair et sombre et en contraste renforcé, en français et en anglais. Les tests manuels, au clavier et avec des lecteurs d’écran, seront menés lors de l’audit. | During development, every page is checked automatically with axe-core (WCAG 2.2 level A and AA criteria) in the Chromium browser, at seven screen widths from 390 to 3,440 pixels, in the light and dark themes and with enhanced contrast, in French and in English. Manual tests, with the keyboard and with screen readers, will be carried out during the audit. |
| common | `declaration.issues.title` | Contenus non accessibles | Inaccessible content |
| common | `declaration.issues.none` | Aucun défaut d’accessibilité n’est recensé à ce jour. Cette liste sera établie par l’audit. | No accessibility issue has been identified so far. This list will be drawn up by the audit. |
| common | `declaration.contact.title` | Retour d’information et contact | Feedback and contact |
| common | `declaration.contact.text` | Si vous n’arrivez pas à accéder à un contenu ou à une fonctionnalité de ce site, écrivez-moi : je vous indiquerai une alternative accessible ou vous transmettrai le contenu sous une autre forme. | If you cannot access some content or a feature of this website, write to me: I will point you to an accessible alternative or send you the content in another format. |
| common | `declaration.contact.link` | M’écrire par e-mail | Email me |
| common | `declaration.contact.subject` | Accessibilité du site | Website accessibility |
| common | `declaration.remedies.title` | Voies de recours | How to seek redress |
| common | `declaration.remedies.text` | Si vous m’avez signalé un défaut d’accessibilité qui vous empêche d’accéder à un contenu ou à une fonctionnalité du site et que vous n’avez pas obtenu de réponse satisfaisante, vous pouvez saisir le Défenseur des droits : | If you have reported an accessibility issue that prevents you from accessing some content or a feature of the website and did not receive a satisfactory answer, you can refer the matter to the Défenseur des droits (the French rights ombudsman): |
| common | `declaration.remedies.message` | Écrire un message au Défenseur des droits | Send a message to the Défenseur des droits (in French) |
| common | `declaration.remedies.delegate` | Contacter le délégué du Défenseur des droits près de chez vous | Contact a local delegate of the Défenseur des droits (in French) |
| common | `declaration.remedies.post` | Envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) : | Send a letter by post (free of charge, no stamp needed): |
| common | `declaration.remedies.address` | Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07 | Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07, France |
| common | `declaration.date` | Déclaration provisoire établie le 21 novembre 2026. | Provisional statement drawn up on 21 November 2026. |
| common | `notFound.title` | Page introuvable | Page not found |
| common | `notFound.text` | L’adresse demandée ne correspond à aucune page de ce site. Elle a peut-être changé, ou contient une faute de frappe. | The address you asked for does not match any page of this website. It may have changed, or contain a typo. |
| common | `notFound.back` | Retour à l’accueil | Back to the home page |
| common | `error.title` | Une erreur est survenue | Something went wrong |
| common | `error.text` | La page n’a pas pu s’afficher. Réessayez dans un instant, ou revenez à l’accueil. | The page could not be displayed. Try again in a moment, or go back to the home page. |
| common | `error.status` | Code de l’erreur : {status} | Error code: {status} |
| common | `error.back` | Retour à l’accueil | Back to the home page |
| shell | `shell.nav.overview` | Vue d’ensemble | Overview |
| shell | `shell.sections.profile` | Profil | Profile |
| shell | `shell.sections.recommendations` | Recos | Recs |
| shell | `shell.sections.ai` | IA | AI |
| shell | `shell.actions.interview` | Lancer l’entretien | Start the interview |
| shell | `shell.actions.cvInFrench` | (en français) | (in French) |
| shell | `shell.actions.subject` | Prise de contact depuis votre site | Getting in touch from your website |
| shell | `shell.theme.toLight` | Thème sombre, passer en thème clair | Dark theme, switch to light theme |
| shell | `shell.theme.toDark` | Thème clair, passer en thème sombre | Light theme, switch to dark theme |
| shell | `shell.scrollHint.label` | Faire défiler vers le bas | Scroll down |
| shell | `shell.accessibility.open` | Options d’accessibilité | Accessibility options |
| shell | `shell.accessibility.close` | Fermer les options d’accessibilité | Close accessibility options |
| shell | `shell.accessibility.panelLabel` | Réglages d’accessibilité | Accessibility settings |
| shell | `shell.accessibility.textSize.label` | taille du texte | text size |
| shell | `shell.accessibility.textSize.normal` | Taille de texte normale | Normal text size |
| shell | `shell.accessibility.textSize.large` | Grande taille de texte | Large text size |
| shell | `shell.accessibility.textSize.larger` | Très grande taille de texte | Largest text size |
| shell | `shell.accessibility.display` | Préférences d’affichage | Display preferences |
| shell | `shell.accessibility.highContrast.label` | Contraste renforcé | Enhanced contrast |
| shell | `shell.accessibility.highContrast.description` | Textes et bordures plus marqués. | Stronger text and borders. |
| shell | `shell.accessibility.readableFont.label` | Police plus lisible | More readable font |
| shell | `shell.accessibility.readableFont.description` | Atkinson Hyperlegible, conçue pour la basse vision. | Atkinson Hyperlegible, designed for low vision. |
| shell | `shell.accessibility.textSpacing.label` | Espacement du texte | Text spacing |
| shell | `shell.accessibility.textSpacing.description` | Lignes, lettres et mots plus espacés (WCAG 1.4.12). | More space between lines, letters and words (WCAG 1.4.12). |
| shell | `shell.accessibility.underlineLinks.label` | Souligner les liens | Underline links |
| shell | `shell.accessibility.underlineLinks.description` | Repérer les liens sans se fier à la couleur. | Spot links without relying on colour. |
| shell | `shell.accessibility.reduceMotion.label` | Réduire les animations | Reduce animations |
| shell | `shell.accessibility.reduceMotion.description` | Coupe les transitions et les glissements. | Turns off transitions and slides. |
| shell | `shell.accessibility.reset` | Réinitialiser | Reset |
| shell | `shell.accessibility.resetDone` | Réglages réinitialisés : le site suit de nouveau les préférences de votre système. | Settings reset: the site follows your system preferences again. |
| shell | `shell.accessibility.declaration` | Déclaration d’accessibilité | Accessibility statement |
| shell | `shell.accessibility.status` | Réglages mémorisés sur cet appareil. Conformité RGAA 4.1 : {pending}. | Settings are saved on this device. RGAA 4.1 conformance: {pending}. |
| shell | `shell.accessibility.pending` | [à compléter après audit] | [to be completed after the audit] |
| shell | `shell.headings.profile` | Profil | Profile |
| shell | `shell.headings.experience` | Expérience | Experience |
| shell | `shell.headings.recommendations` | Recommandations | Recommendations |
| shell | `shell.headings.ai` | IA | AI |
| profile | `profile.situation.now` | en ce moment | right now |
| profile | `profile.situation.seeking` | ce que je recherche | what I’m looking for |
| profile | `profile.situation.location` | lieu | location |
| profile | `profile.situation.availability` | disponibilité | availability |
| profile | `profile.social.label` | Réseaux | Social links |
| experience | `experience.present` | aujourd’hui | present |
| experience | `experience.breakOrganisation` | Projet personnel | Personal project |
| experience | `experience.workMode.onsite` | sur site | on-site |
| experience | `experience.workMode.hybrid` | hybride | hybrid |
| experience | `experience.workMode.remote` | à distance | remote |
| experience | `experience.contractType.cdi` | CDI | Permanent |
| experience | `experience.filter.label` | filtrer par techno | filter by tech |
| experience | `experience.filter.searchLabel` | Filtrer les expériences | Filter experiences |
| experience | `experience.filter.placeholderEmpty` | Ex. Kafka, Docker… ({n} technos) | E.g. Kafka, Docker… ({n} techs) |
| experience | `experience.filter.placeholderMore` | Ajouter une techno… | Add a tech… |
| experience | `experience.filter.clear` | Effacer | Clear |
| experience | `experience.filter.clearAll` | Effacer tous les filtres | Clear all filters |
| experience | `experience.filter.removeChip` | Retirer le filtre {name} | Remove filter {name} |
| experience | `experience.filter.live.all` | {n} expérience affichée \| {n} expériences affichées | {n} experience shown \| {n} experiences shown |
| experience | `experience.filter.live.results` | {n} expérience avec toutes les technos choisies \| {n} expériences avec toutes les technos choisies | {n} experience with all the chosen techs \| {n} experiences with all the chosen techs |
| experience | `experience.filter.live.empty` | Aucune expérience ne combine toutes ces technos | No experience combines all these techs |
| experience | `experience.suggestions.label` | Suggestions de technos | Tech suggestions |
| experience | `experience.suggestions.noXp` | sans XP détaillée | no detailed XP |
| experience | `experience.suggestions.add` | Ajouter {name}, {n} XP | Add {name}, {n} XP |
| experience | `experience.suggestions.disabled` | {name}, {n} XP : indisponible avec les filtres en cours | {name}, {n} XP: unavailable with the current filters |
| experience | `experience.suggestions.unlinked` | {name}, sans XP détaillée | {name}, no detailed XP |
| experience | `experience.suggestions.none` | Aucune techno ne correspond à « {query} ». | No tech matches “{query}”. |
| experience | `experience.suggestions.showAll` | Voir toutes les technos | Show all techs |
| experience | `experience.drawer.mainStack` | stack principale | main stack |
| experience | `experience.drawer.showAll` | Toutes les technos ({n}) | All techs ({n}) |
| experience | `experience.drawer.hideAll` | Masquer la liste | Hide the list |
| experience | `experience.drawer.close` | Fermer | Close |
| experience | `experience.drawer.intro` | Toutes mes technos, par domaine. Le chiffre indique le nombre d’expériences ; en pointillé, celles sans expérience détaillée. | All my techs, by domain. The number is the count of experiences; dashed ones have no detailed experience. |
| experience | `experience.drawer.unlinkedHint` | pas d’expérience détaillée | no detailed experience |
| experience | `experience.tech.available` | {name}, {n} expérience \| {name}, {n} expériences | {name}, {n} experience \| {name}, {n} experiences |
| experience | `experience.tech.disabled` | {name}, {n} expérience avec les filtres en cours | {name}, {n} experiences with the current filters |
| experience | `experience.list.label` | Liste des expériences | List of experiences |
| experience | `experience.results.withAll` | Avec toutes ces technos · {n} | With all these techs · {n} |
| experience | `experience.results.withOne` | Avec {tech} · {n} | With {tech} · {n} |
| experience | `experience.results.others` | Les autres expériences · {n} | The other experiences · {n} |
| experience | `experience.results.partial` | En partie : {techs} | Partly: {techs} |
| experience | `experience.results.empty` | Aucune expérience ne combine toutes ces technos. Retirez-en une, ou consultez les autres expériences. | No experience combines all these techs. Remove one, or look at the other experiences. |
| experience | `experience.results.show` | Voir l’autre expérience \| Voir les {n} autres expériences | Show the other experience \| Show the {n} other experiences |
| experience | `experience.results.hide` | Masquer l’autre expérience \| Masquer les {n} autres expériences | Hide the other experience \| Hide the {n} other experiences |
| experience | `experience.results.showAll` | Voir l’expérience \| Voir les {n} expériences | Show the experience \| Show the {n} experiences |
| experience | `experience.results.hideAll` | Masquer l’expérience \| Masquer les {n} expériences | Hide the experience \| Hide the {n} experiences |
| experience | `experience.card.detail` | Détail : {title} | Details: {title} |
| experience | `experience.card.detailAt` | Détail : {title} chez {organisation} | Details: {title} at {organisation} |
| experience | `experience.card.filterBy` | Filtrer par {name} | Filter by {name} |
| experience | `experience.easterEgg.label` | Huile de coude | Elbow grease |
| experience | `experience.easterEgg.close` | Retour au CV | Back to the CV |
| experience | `experience.easterEgg.closeWindow` | Fermer | Close |
| experience | `experience.easterEgg.installed` | 1 paquet ajouté, 0 dépendance, en 21 mois | 1 package added, 0 dependencies, in 21 months |
| experience | `experience.easterEgg.tests` | tests en conditions réelles | tests in real conditions |
| experience | `experience.easterEgg.build` | build projet-immobilier | build real-estate-project |
| experience | `experience.easterEgg.done` | Terminé. 0 vulnérabilité (sauf le dos). | Done. 0 vulnerabilities (except the back). |
| recommendations | `recommendations.seeOnLinkedIn` | Voir sur LinkedIn | See on LinkedIn |
| recommendations | `recommendations.empty` | Aucune recommandation publiée pour le moment. | No recommendation published yet. |
| ai | `ai.tagsLabel` | Mots-clés | Keywords |
