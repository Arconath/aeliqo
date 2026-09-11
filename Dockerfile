# The site is built with the same locked Node and pnpm versions used by the
# rewrite.  Keep the runtime image independent of the build toolchain.
ARG SOURCE_REVISION=unknown

FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS site-build

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
COPY examples ./examples
COPY tests ./tests
COPY design ./design
COPY docs/public-site ./docs/public-site
COPY scripts/docs ./scripts/docs
COPY harness/components.json ./harness/components.json

RUN pnpm install --frozen-lockfile
RUN pnpm build:docs-artifact && pnpm build:agent
RUN rm -rf /workspace/apps/site/dist /workspace/artifacts/site-source /workspace/artifacts/site-public \
  && node --input-type=module -e 'const {generatePages}=await import("./apps/site/generate-pages.mjs"); await generatePages()' \
  && test -f /workspace/artifacts/site-source/index.html

FROM site-build AS site-generated
RUN pnpm --filter @aeliqo/site build \
  && test -f /workspace/apps/site/dist/404/index.html \
  && test -f /workspace/apps/site/dist/404.html

FROM golang:1.27.0-alpine@sha256:4c9fe60190a2a3350ddc51de80d0224b8a6698d12bdfc999fee45ea9d6c46dbc AS server-build

ARG SOURCE_REVISION
WORKDIR /src
COPY deploy/server.go ./server.go

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath \
  -ldflags="-s -w -X main.revision=${SOURCE_REVISION}" \
  -o /aeliqo-static-server ./server.go

FROM scratch

ARG SOURCE_REVISION
LABEL org.opencontainers.image.source="https://github.com/Arconath/aeliqo"
LABEL org.opencontainers.image.description="Aeliqo static rewrite site"
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"

COPY --from=server-build /aeliqo-static-server /aeliqo-static-server
COPY --from=site-generated /workspace/apps/site/dist /srv/aeliqo

WORKDIR /srv/aeliqo
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/aeliqo-static-server"]
