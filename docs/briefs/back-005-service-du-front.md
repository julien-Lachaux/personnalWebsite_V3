# Brief back-005 : servir le front statique dans la pile (F9)

Demandeur : session front, 21 novembre 2026. Lancement validé par Julien le même jour.
Destinataire : session back, propriétaire de `docker/`, `scripts/deploy/`, de la CI et de la pile
locale (`pnpm stack:*`).

## Contexte
Le front (`apps/web`, Nuxt 4) est une **génération statique** : `nuxt generate` produit
`apps/web/.output/public` (pages fr à la racine, en sous `/en/`, polices, CV PDF), sans serveur Node en
production (docs/05, D2). La génération lit le contenu à l'API au build (`GET /api/v1/cv?lang=fr|en`) et
échoue si l'API ne répond pas (pas de repli sur les fixtures). Aujourd'hui Caddy sert
`docker/placeholder/` à la place du front (`docker/Caddyfile`, `handle` final ; exemple commenté d'un
service `web` dans `docker/compose.prod.yml`).

Variables de build du front (docs `CLAUDE.md`, section Front ; `apps/web/.env.example`) :
- `NUXT_CV_SOURCE=api` et `NUXT_API_BASE_URL` (sans `/api/v1`) : source du contenu au build ;
- `NUXT_PUBLIC_CONTACT_EMAIL` : adresse du `mailto:` (valeur réelle fournie au déploiement, jamais dans
  le dépôt ; la génération échoue si elle est vide ou invalide) ;
- `NUXT_PUBLIC_I18N_BASE_URL` : URL publique absolue (canonical, hreflang).

## BF-13 Construire le front
- Une étape de build (image multi-étapes ou job de déploiement) qui lance `nuxt generate` contre l'API
  de production **déjà migrée et seedée**, et produit une image ou un volume contenant
  `.output/public`. À toi de choisir l'option la plus simple et la plus sûre (image dédiée servie par
  Caddy, ou fichiers copiés dans un volume monté par Caddy) ; justifie-la.
- Ordre au déploiement : base → migrate/seed → API saine (`/health`) → génération du front → bascule
  de Caddy. Un échec de génération laisse le site précédent en place.

## BF-14 Servir le front par Caddy
- Remplacer le `handle` du placeholder par le service des fichiers statiques du front (`file_server`,
  `try_files` adaptés au prérendu : `/` → `index.html`, `/en/` → `en/index.html`, page 404 du front
  servie avec le statut 404).
- **Redirection 301** de `/fr` et `/fr/*` vers le même chemin sans préfixe (aujourd'hui une page
  `meta refresh` en 200 générée par Nuxt : Caddy doit la doubler par une vraie 301, D15, F9-03).
- **CSP stricte** du front (F9-03) : `default-src 'self'`, pas de domaine tiers (polices et PDF
  auto-hébergés), `script-src 'self'` + l'empreinte du script de thème
  `'sha256-nzuLVqI8ekzAXFcdRbwjQkxQig8MPDlNQ5+0PkfBJwY='` (constante `THEME_SCRIPT_SHA256` de
  `apps/web/app/domain/theme-script.ts`, vérifiée par un test) + les empreintes des scripts en ligne
  que Nuxt génère (`importmap`, `window.__NUXT__`), **qui changent à chaque génération** : à calculer
  après chaque `generate` (script qui lit les `<script>` en ligne de `.output/public/**/*.html`) ;
  `style-src` : Nuxt intègre des `<style>` en ligne (19 dans la page) — empreintes ou
  `'unsafe-inline'` pour les styles seulement, à trancher et justifier ; `frame-ancestors 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`.
- En-têtes déjà posés pour tout le site (HSTS, nosniff, Referrer-Policy, Permissions-Policy) : inchangés.
- Cache : fichiers à empreinte de `/_nuxt/` en `immutable` longue durée ; HTML et PDF en revalidation.

## BF-15 Pile locale et e2e
- `pnpm stack:up` construit et sert aussi le front ; un parcours de fumée contre la pile vérifie : `/`
  et `/en` en 200 avec le vrai contenu, `/fr` en 301, une route inconnue en 404 (page du front),
  `/cv/cv-fr.pdf` en 200 `application/pdf`, la CSP présente et **aucune violation CSP** dans la
  console du navigateur (Playwright du front contre la pile, ou script équivalent).
- Le job CI `pile-locale` (laissé sans le front en F3a) couvre ce parcours.

## Hors périmètre
Aucun changement de l'API ni du contrat. Le contenu du front et ses tests restent à la session front ;
si un besoin côté `apps/web` apparaît (ex. script d'extraction des empreintes à placer dans
`apps/web/scripts/`), dis-le : la session front le fait.

Règles habituelles : une seule vérification complète à la fois sur la machine (D26), autorisations sur
les configurations protégées, chaque commit cite son ticket (BF-13 à BF-15).
