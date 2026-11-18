# État des lieux de la V2 (18 novembre 2026)

Source : `../personnalWebsite_V2` (Symfony 4.4.9, PHP 7.4, MySQL 5.7, Twig 2, Doctrine ORM 2.7,
jQuery 3.5 + svg.js, Webpack Encore 0.30 / node-sass). Docker dev et prod (Caddy + Apache).
Seed idempotent `app:seed:cv`, 22 tests PHPUnit. Audits sécurité et accessibilité dans `V2/.claude/`.

## Fonctionnement

- Une seule page HTML (`/{page}`) qui charge ensuite en AJAX : `/ajax/nav`, `/ajax/panel/{home|skills|experiences|favoris|realisations}`,
  `/ajax/modal/contact`, `/ajax/assets/stylesheets`. Le serveur rend du HTML Twig, pas du JSON.
- Les décorations SVG sont lues sur disque par le contrôleur et injectées en `|raw`.
- Pas d'authentification, pas d'admin fonctionnel (templates vides), pas de formulaire de contact
  (tel / e-mail affichés en clair dans la modale).
- Catch-all `/{page}` qui rend la home pour n'importe quelle URL ; panels inconnus en 500.

## Modèle de données V2 (9 entités)

| Table | Champs | Remarques |
|---|---|---|
| profile | firstname, lastname (PK composite), title, email, tel, github, linkedin, freelance_website, picture, description | une seule ligne |
| panels | title, subtitle, colorTheme FK, decorations JSON, navUrl, navText, navIcon, navOrder, displayed | la nav est en base |
| color_themes | name, color, colorLight, colorDark, text, textHover, accent, accentLight, accentDark | 7 thèmes, pur design |
| skills_groups | name, description, color (hex6) | 4 groupes |
| skills | group FK, name, level (1-5), picture (classe devicon), displayed | 31, tous à 3 |
| experiences | company, job, logo, description (HTML), date_start, date_end nullable, displayed, tags M2M skills | 7 |
| tools | name, picture, link, family, decoration, displayed | 4, inventés |
| favoris | group FK skills_groups, name, link, picture, displayed | vide, panel masqué |
| realisations | title, description, github, preview, img_laptop, img_phone | vide, panel masqué |

### Ce qui ne rentre pas dans le schéma V2 (CV)

Pause professionnelle, certifications, formation, langues, localisation, lieu et type de contrat
des expériences, réalisations sous forme de liste structurée (résumé + réalisations) au lieu de HTML.

## Enseignements pour la V3

- Séparer contenu et présentation : couleurs, décorations, ordre de nav et icônes n'ont rien à faire
  dans la base de données de contenu. Ils relèvent du design system du front.
- Pas de HTML en base : `description` devient texte + liste de réalisations, rendu par le front.
- Rendu serveur complet de chaque vue et sémantique HTML (audit accessibilité : 31 constats, 4 bloquants).
- Stack à jour (Symfony 4.4 et Twig 2 EOL, 39 avis Composer, 1004 avis npm) : la migration est
  le seul correctif.
- Sécurité V3 : en-têtes HTTP, 404 propres, validation des entrées, CSRF si formulaire, données
  personnelles jamais exposées par une API publique.
