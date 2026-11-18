# Image de production de l'API : build multi-étape, runtime sans pnpm ni sources TypeScript.
# Même version de Node que `.npmrc` (use-node-version). Dans l'image, `.npmrc` n'est pas copié :
# pas de téléchargement de Node par pnpm. Node 26 n'embarque plus corepack : pnpm est installé
# via npm, à la version du champ packageManager.

ARG NODE_VERSION=26.13.1

# --- deps : dépendances du monorepo (lockfile figé) ---------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true
WORKDIR /repo
RUN npm install --global pnpm@9.0.0 --no-fund --no-audit
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- build : compile les contrats puis l'API ----------------------------------------------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm turbo run build --filter=@siteperso/api...

# --- prune : API seule avec ses dépendances de production ---------------------------------
FROM build AS prune
RUN pnpm deploy --filter=@siteperso/api --prod /out

# --- runtime ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Disposition /repo/apps/api + /repo/db : les CLI (migrate, seed) résolvent db/ depuis dist/cli/ vers la racine du dépôt.
WORKDIR /repo/apps/api
COPY --from=prune --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json
COPY --chown=node:node db /repo/db
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
