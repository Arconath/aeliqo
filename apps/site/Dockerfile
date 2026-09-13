ARG SOURCE_REVISION=unknown
ARG SDK_SOURCE_REVISION=unknown
ARG SDK_VERSION=unknown

FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS site-build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY docs-artifact.mjs generate-pages.mjs index.html playground.html vite.config.mjs ./
COPY public ./public
COPY scripts/verify-inputs.mjs ./scripts/verify-inputs.mjs
COPY src ./src
COPY vendor ./vendor

RUN pnpm install --frozen-lockfile
RUN pnpm build \
  && test -f /workspace/dist/index.html \
  && test -f /workspace/dist/404.html \
  && test -f /workspace/dist/docs/components/data.table/index.html

FROM golang:1.27.0-alpine@sha256:4c9fe60190a2a3350ddc51de80d0224b8a6698d12bdfc999fee45ea9d6c46dbc AS server-build

ARG SOURCE_REVISION
ARG SDK_SOURCE_REVISION
ARG SDK_VERSION
WORKDIR /src
COPY deploy/server.go ./server.go

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath \
  -ldflags="-s -w -X main.revision=${SOURCE_REVISION} -X main.sdkRevision=${SDK_SOURCE_REVISION} -X main.sdkVersion=${SDK_VERSION}" \
  -o /aeliqo-static-server ./server.go

FROM scratch

ARG SOURCE_REVISION
ARG SDK_SOURCE_REVISION
ARG SDK_VERSION
LABEL org.opencontainers.image.source="https://github.com/Arconath/aeliqo"
LABEL org.opencontainers.image.description="Aeliqo public documentation and playground"
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
LABEL com.aeliqo.sdk.revision="${SDK_SOURCE_REVISION}"
LABEL com.aeliqo.sdk.version="${SDK_VERSION}"

COPY --from=server-build /aeliqo-static-server /aeliqo-static-server
COPY --from=site-build /workspace/dist /srv/aeliqo

WORKDIR /srv/aeliqo
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/aeliqo-static-server"]
