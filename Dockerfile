# syntax=docker/dockerfile:1.7
# Targets: api | web | field.   docker build --target api -t publipulse-api .
ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27-alpine

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /repo

# ---- dependency layers (manifests only, so source edits do not bust the install cache)
FROM base AS manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/field/package.json apps/field/
COPY docker/install.sh docker/install.sh

FROM manifests AS deps-all
ARG ALLOW_NO_LOCKFILE=0
ENV ALLOW_NO_LOCKFILE=${ALLOW_NO_LOCKFILE}
RUN --mount=type=cache,target=/root/.npm sh docker/install.sh

FROM manifests AS deps-api-prod
ARG ALLOW_NO_LOCKFILE=0
ENV ALLOW_NO_LOCKFILE=${ALLOW_NO_LOCKFILE}
RUN --mount=type=cache,target=/root/.npm sh docker/install.sh --omit=dev -w @publipulse/api

# ---- builds
FROM deps-all AS build-shared
COPY packages/shared packages/shared
RUN npm run build -w @publipulse/shared

FROM build-shared AS build-api
COPY apps/api apps/api
RUN npm run build -w @publipulse/api

FROM build-shared AS build-web
COPY apps/web apps/web
RUN npm run build -w @publipulse/web

FROM build-shared AS build-field
COPY apps/field apps/field
RUN npm run build -w @publipulse/field

# ---- api runtime
FROM node:${NODE_VERSION}-bookworm-slim AS api
ENV NODE_ENV=production API_PORT=4000
WORKDIR /repo
COPY package.json ./
COPY --from=deps-api-prod /repo/node_modules ./node_modules
COPY --from=build-api /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build-api /repo/packages/shared/dist packages/shared/dist
COPY --from=build-api /repo/apps/api/package.json apps/api/package.json
COPY --from=build-api /repo/apps/api/dist apps/api/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]

# ---- static frontends (unprivileged nginx on :8080)
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx-security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build-web /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080

FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS field
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx-security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build-field /repo/apps/field/dist /usr/share/nginx/html
EXPOSE 8080
