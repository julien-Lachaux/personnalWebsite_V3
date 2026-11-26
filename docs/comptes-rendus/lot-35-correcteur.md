# Lot 35 : mise à jour des tests obsolètes par D48 (correcteur, ticket L35-2)

Date : 26 novembre 2026. Autorisation « tests » L35-TESTS (D23), `Justification-test: L35-TESTS`.
Aucune assertion supprimée ni affaiblie : mêmes assertions, nouvelles valeurs (la partie B ajoute une assertion).
Podman bloqué : aucune commande podman, docker, compose ni playwright lancée.

## Partie A : page « panne du serveur »

Avant : `error-server.spec.ts` avait 3 tests en échec sur les nouveaux textes (sortie du lead, 28 passés,
3 en échec). Après : `vitest run --project nuxt app/error-server.spec.ts app/error-outage.spec.ts
app/i18n-messages.spec.ts app/i18n-hardcoded.spec.ts` : 4 fichiers, 25 tests passés ;
`test:coverage` du front 100 % (1469/1469, 798/798, 491/491, 1308/1308).

| Fichier:ligne | Avant | Après | Preuve |
|---|---|---|---|
| error-server.spec.ts 70, 124 | h1 `Site indisponible pour l’instant` | `Le serveur est en panne pour l’instant` | `serverError.title` fr de `common.json` |
| error-server.spec.ts 74 | `Le serveur n’a pas pu répondre à votre demande.` | `Le site ne peut pas s’afficher pour le moment.` | `serverError.text` fr |
| error-server.spec.ts 75 | `>_ erreur-50x.log` | `>_ panne-serveur.log` | `file` dans `error.vue` |
| error-server.spec.ts 83 | titre du document fr | idem nouveau titre fr | `useHead` de `error.vue` |
| error-server.spec.ts 95, 106 | `Website temporarily unavailable` | `The server is temporarily down` | `serverError.title` en |
| error-server.spec.ts 96 | `The server could not answer your request.` | `The site can’t be displayed right now.` | `serverError.text` en |
| server-error.e2e.ts 29, 41 | titre fr ancien | `Le serveur est en panne pour l’instant` | idem |
| server-error.e2e.ts 30, 42 | texte fr ancien | `Le site ne peut pas s’afficher pour le moment.` | idem |
| server-error.e2e.ts 53, 65 | titre en ancien | `The server is temporarily down` | idem |
| server-error.e2e.ts 54, 66 | texte en ancien | `The site can’t be displayed right now.` | idem |
| server-error.e2e.ts 123 | `>_ erreur-50x.log` | `>_ panne-serveur.log` | idem |
| server-error.e2e.ts 363 | libellé fr ancien cherché dans la page anglaise | nouveau titre fr (sinon le test ne vérifie plus rien) | idem |

`server-error.e2e.ts` : **non rejoué** (Playwright, Podman bloqué) ; justesse par lecture du code et des
`common.json`.

## Partie B : API / Caddy (non rejoué)

Source : `docker/Caddyfile` l. 160-166 (bloc `@apierr` : `Content-Type application/problem+json`, corps
`{"type":"about:blank","title":"{err.status_text}","status":{err.status_code},"detail":"Le service est
momentanément indisponible. Réessayez dans quelques instants."}`), identique dans `Caddyfile.vps` et
`host-errors.caddy` ; `panne-api-caddy.e2e-spec.ts` l. 150 affirme le même corps exact pour un 502.

| Fichier | Avant | Après |
|---|---|---|
| wip-mode.e2e-spec.ts 201-206 | « laisse /api/* répondre comme avant : 502 en texte brut… » ; `text/plain` ; corps `502 Bad Gateway` | « répond en problem+json 502 sous /api/* quand l’API est arrêtée, jamais la page 50x » ; `application/problem+json` ; corps JSON exact |
| local-stack.e2e-spec.ts 278-285 | « API arrêtée : 502 text/plain… (écart connu) » ; `text/plain` | « 502 problem+json produit par Caddy (D48), sans Server » ; `application/problem+json` ; statut et absence de `Server` gardés ; corps exact ajouté |

**Non rejoués** (ils lancent des conteneurs) : `wip-mode.e2e-spec.ts`, `local-stack.e2e-spec.ts`.
