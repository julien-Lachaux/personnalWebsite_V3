# Données du front V3 : mapping handoff → API

Validé par Julien le 19 novembre 2026 (« on commence comme ça, on itère »). Source du design :
handoff v6 (`SPEC.md`, `data/site-content.json`), copie de travail hors dépôt dans
`../front-handoff-v6/`. Ce document dit d'où le front tire chaque donnée affichée. Les évolutions
du back qu'il implique sont demandées dans `docs/briefs/back-001-donnees-front.md` (tickets BF-*).

## Principes

- Le front lit l'API, jamais `site-content.json` : celui-ci a servi de source pour les seeds et sert
  de base aux fixtures du front (validées contre `@siteperso/contracts`).
- Une seule lecture par langue : `GET /api/v1/cv?lang=fr|en`, au build (génération statique Nuxt).
- Ce qui relève de la présentation (libellés d'interface, noms de fichiers des fenêtres, mise en
  forme des dates, préfixes) vit dans le front (i18n), pas en base (docs/01, « contenu et
  présentation séparés »).
- Slugs : ceux des seeds font foi (`pause-professionnelle`, `wynd-integration`,
  `openclassrooms-mentor`), les `id` du handoff ne servent qu'aux maquettes.

## Profil (BF-1)

| Affiché | Champ handoff | Source API |
|---|---|---|
| « Développeur / full-stack » | `profile.title.line1/line2` | `profile.title` (« Développeur full-stack ») ; la coupure de ligne est de la présentation |
| pastille « senior » | `profile.title.badge` | `profile.titleBadge` (nouveau) |
| 2 accroches | `profile.taglines` | `profile.taglines string[]` (remplace `headline`) |
| mission | `profile.mission` | `profile.mission` (nouveau, remplace `bio` avec `intro`) |
| intro | `profile.intro` | `profile.intro` (nouveau) |
| « en ce moment » | `profile.currently` | `profile.currentActivity` (nouveau) |
| « ce que je recherche » : format, lieu, disponibilité | `profile.lookingFor.*` | `profile.seekingFormat`, `seekingLocation`, `seekingAvailability` (nouveaux, remplacent `availability`) |
| bouton CV PDF | `profile.links.cvPdf` | `profile.cvPath` (nouveau, par langue : `/cv/cv-fr.pdf`, `/cv/cv-en.pdf`, fichiers statiques du front, métadonnées nettoyées) |
| non affichés | — | `firstName`, `lastName`, `location` (« Melun »), `picture` : conservés, pas utilisés par le design v6 |

Les textes du handoff font foi sur ceux des seeds actuels.

## Liens (BF-6)

| Affiché | Source |
|---|---|
| bouton LinkedIn | `socialLinks[slug=linkedin]` |
| « Recommandations publiées sur LinkedIn ↗ », « Voir sur LinkedIn » | `socialLinks[slug=linkedin-recommendations]` (nouveau) |
| bouton GitHub | `socialLinks[slug=github]` : absent tant que l'URL n'est pas connue (point ouvert P1) ; le bouton est masqué si le lien manque |
| Lancer l'entretien | `mailto:` construit par le front, adresse en variable de configuration du front (placeholder dans le dépôt) ; pas de formulaire pour l'instant |

## Expériences (BF-2)

| Affiché | Source |
|---|---|
| intitulé | `experiences[].jobTitle` |
| organisation | `company` ; pour `kind = break`, libellé i18n du front (« Projet personnel ») |
| préfixe `@` / `›` | déduit de `kind` (`break` → `›`) |
| période « janv. 2026 – mai 2026 » | `dateStart`, `dateEnd` formatées par `Intl.DateTimeFormat` (fr, en) ; `dateEnd = null` → « aujourd'hui » |
| « Paris, hybride · CDI » | `location` + libellé i18n de `workMode` + libellé i18n de `contractType` (`none` → rien) |
| résumé | `summary` (celui des seeds pour Contentsquare, que le handoff laisse vide) |
| détail en accordéon | `achievements` |
| puces de stack | `skills` où `shownInStack = true`, dans l'ordre ; pour `kind = break`, une puce `stackLabel` (« Huile de coude ») qui ouvre l'easter egg |
| mots-clés cachés du filtre | `skills` où `shownInStack = false` (nouveau champ) |

## Technos et filtre (BF-3)

| Affiché | Source |
|---|---|
| groupes « Toutes les technos (N) » | `skillGroups[]` avec leurs `skills`, N calculé |
| nom d'une techno | `skill.name` (noms courts du design repris dans les seeds) |
| compteur d'XP par techno | calculé par le front à partir de `experiences[].skills` (puces et mots-clés) |
| pointillé, non cliquable | compétence publiée liée à aucune expérience |
| « stack principale » (7) | `skills` où `mainStackOrder != null`, triées par `mainStackOrder` (nouveau champ) |
| non affichés | `level`, `icon`, `iconPath` |

La liste affiche toutes les compétences publiées des seeds (plus que les 25 du design : Elysia.js,
Solid.js, MongoDB, HTML5, CSS figurent dans des stacks et doivent pouvoir filtrer).

## Recommandations (BF-4)

| Affiché | Source |
|---|---|
| auteur | `recommendations[].authorName` |
| rôle | `authorRole` |
| contexte « Responsable direct de Julien · 8 décembre 2025 » | `relationship` + `recommendedOn` formatée par le front |
| citation | `paragraphs string[]`, rendue en `blockquote`, `lang` = `recommendations[].locale` |

Les citations ne sont pas traduites : en `/en`, le repli par ligne sert la ligne `fr`, et le front
pose `lang="fr"` grâce au champ `locale`. Seedées en `published = false` tant que l'accord des
auteurs n'est pas obtenu : la section Recos affiche alors un état vide prévu par le front.

## IA (BF-5)

| Affiché | Source |
|---|---|
| titre de la section | `aiOverview.title` |
| « dans le produit · Nopillo, 2026 » + 3 points | `aiOverview.inProductLabel`, `inProductItems` |
| « au quotidien » + texte | `aiOverview.dailyLabel`, `dailyText` |
| tags (Mastra, Développement agentique) | `aiOverview.skills[]` |

Le `[À COMPLÉTER : outils, méthode, exemples]` n'est pas seedé : le contenu viendra de Julien.

## Front uniquement (i18n et configuration)

`meta.handle` (`julien-lachaux`), noms de fichiers des tuiles et fenêtres, libellés de navigation,
lignes de l'easter egg, réglages d'accessibilité (`accessibility.*`), libellés du `mailto:`, lien et
statut de la déclaration d'accessibilité, adresse e-mail (configuration, jamais commitée).

## Hors design v6 (rien à faire)

`projects`, `tools`, `resources`, `certifications`, `education`, `languages` restent servis par
l'API et ne sont pas affichés. La cinquième entrée de navigation pourra en accueillir plus tard.
