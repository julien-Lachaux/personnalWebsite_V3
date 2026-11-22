# Image de GÉNÉRATION du front (BF-13) : elle ne sert rien. Au lancement (`compose run web-build`),
# elle lance `nuxt generate` contre l'API de la pile (déjà migrée, seedée et saine), relève les
# empreintes CSP des pages et publie le résultat dans le volume du site (scripts/deploy/web-generate.sh).
# Caddy sert ce volume en lecture seule : aucun serveur Node du front en production (docs/05, D2).
# Même image de base que l'API (épinglée par digest ; elle doit rester celle de `.npmrc`).
ARG NODE_IMAGE=node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

# --- deps : dépendances du front et des contrats (lockfile figé) --------------------------
FROM ${NODE_IMAGE} AS deps
ENV CI=true
WORKDIR /repo
RUN npm install --global pnpm@10.34.9 --no-fund --no-audit
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
# `--ignore-scripts` : pas de `nuxt prepare` ici (les sources n'y sont pas encore) ; la génération le fait.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @siteperso/web...

# --- build : contrats compilés (le front les lit dans leur dist/) -------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
RUN pnpm --filter @siteperso/contracts build
COPY apps/web apps/web

# --- runtime : sources et outils de génération, utilisateur non root ----------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    CI=true \
    SITE_DIR=/site
WORKDIR /repo
COPY --from=build /repo /repo
COPY scripts/deploy/web-generate.sh scripts/deploy/csp-hashes.mjs /opt/deploy/
# /site : volume du site. Créé et possédé par `node` ici pour que Docker initialise le volume avec ces
# droits (le conteneur tourne sans privilège et en lecture seule, sauf ce volume et des tmpfs).
# `apps/web` appartient à `node` (Nuxt y écrit .nuxt, .output et ses caches).
RUN mkdir -p /site && chown node:node /site && chown -R node:node /repo/apps/web \
    && chmod 755 /opt/deploy/web-generate.sh
USER node
WORKDIR /repo/apps/web
CMD ["/opt/deploy/web-generate.sh"]
