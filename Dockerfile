FROM node:22.22-alpine@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd AS build

WORKDIR /src
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tests ./tests
COPY tsconfig.json vite.config.ts eslint.config.js ./
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8

ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/Arconath/aeliqo"
USER root
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
RUN printf '{"product":"aeliqo","revision":"%s"}\n' "$SOURCE_REVISION" > /usr/share/nginx/html/version.json
USER 101
EXPOSE 8080
