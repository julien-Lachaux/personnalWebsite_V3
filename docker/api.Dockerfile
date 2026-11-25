# Image de production de l'API : build multi-étape, runtime sans pnpm ni sources TypeScript.
# Même version de Node que `devEngines.runtime` du package.json racine. Dans l'image, Node vient de
# l'image de base : `pnpm install --no-runtime` ne télécharge pas ce runtime. Node 26 n'embarque plus
# corepack : pnpm est installé via npm, à la version du champ packageManager.

# Image de base épinglée par digest (reproductible, insensible à un tag déplacé). La version doit rester
# celle de `devEngines.runtime` (package.json racine) ; la mise à jour du tag et du digest se fait par un lot (Dependabot est désactivé).
ARG NODE_IMAGE=docker.io/library/node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

# --- deps : dépendances du monorepo (lockfile figé) ---------------------------------------
FROM ${NODE_IMAGE} AS deps
ENV CI=true
WORKDIR /repo
RUN npm install --global pnpm@12.23.0 --no-fund --no-audit
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --no-runtime

# --- build : compile les contrats puis l'API ----------------------------------------------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm turbo run build --filter=@siteperso/api...
# `db:reset` détruit tout le schéma : jamais livré dans l'image (sa garde NODE_ENV=production se
# contourne avec NODE_ENV=development).
RUN rm -f apps/api/dist/cli/reset.* apps/api/dist/infrastructure/db/reset-database.*

# --- prune : API seule avec ses dépendances de production ---------------------------------
FROM build AS prune
RUN pnpm deploy --legacy --filter=@siteperso/api --prod /out

# --- runtime ------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Disposition /repo/apps/api + /repo/db : les CLI (migrate, seed) résolvent db/ depuis dist/cli/ vers la racine du dépôt.
WORKDIR /repo/apps/api
# Sans `--chown` : le code, `node_modules` et `db/` restent à root, en lecture seule pour l'utilisateur
# `node` qui exécute l'API (un code injecté ne peut pas modifier `dist/`).
COPY --from=prune /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY db /repo/db
# Le runtime n'a besoin ni de npm ni de yarn, ni d'outils réseau en ligne de commande (busybox) :
# moins d'outils sous la main d'un code injecté.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/lib/node_modules/corepack /opt/yarn-* /usr/local/bin/yarn* \
    && rm -f /usr/bin/wget /usr/bin/nc
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
