# Brief back-006 : suites de la revue de sécurité du front (F10)

Émetteur : session front, 23 novembre 2026. Source : `docs/revues/securite-front-2026-11-23.md`,
`docs/revues/triage-front-2026-11-23.md` (branche `lot/F10-revues`), décision D40 de Julien
(`docs/05-front-organisation.md`). Rien ne bloque le front : à planifier par la session back.

## BF-16 : chemin du CV limité à un chemin du site (RS-1, gravité faible)

- Constat : `SITE_PATH_PATTERN` (`packages/contracts/src/profile/profile.ts:10`, `/^\/[^/\s]\S*$/`)
  refuse `//` mais accepte `/\h.example/x.pdf`, que le navigateur résout vers l'hôte `h.example`
  (vérifié avec `new URL('/\\h.example/x.pdf', 'https://site.example')`). Le front rend ce chemin tel
  quel dans le lien du CV (`app/domain/cv-link.ts`). Le contenu ne vient que des seeds.
- Attendu :
  - le motif refuse aussi `\` en deuxième position (et, au choix du back, tout `\`) ;
  - une contrainte en base garde `cv_path` sous `/cv/` (ex. `check (cv_path like '/cv/%')`), si le
    modèle de données le permet ;
  - tests du contrat avec `/\h.example/x.pdf` refusé, `/cv/cv-fr.pdf` accepté.

## BF-17 : `img-src` sans `data:` (RS-5, information)

- Constat : `scripts/deploy/csp-hashes.mjs` (`buildPolicy`, l. 81) pose `img-src 'self' data:` ; le
  site généré ne contient aucune image `data:` (vérifié sur `.output/public`).
- Attendu : `img-src 'self'`, tests du script mis à jour.
- Coordination (D40) : en F11, `apps/web/test/csp.e2e.ts` importera `buildPolicy` de ce script au
  lieu d'en garder une copie. Prévenir la session front quand BF-17 est fusionné ; garder la
  signature `buildPolicy({ scripts, styles })` exportée (ou prévenir si elle change).
