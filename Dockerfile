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

FROM golang:1.26.6-alpine@sha256:3889b425f035be855a72fb4755265311293b6d414521f0a519d819df32222d83 AS server-build

ARG SOURCE_REVISION=unknown
WORKDIR /src
COPY deploy/server.go ./server.go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w -X main.revision=${SOURCE_REVISION}" -o /aeliqo-server ./server.go

FROM scratch

LABEL org.opencontainers.image.source="https://github.com/Arconath/aeliqo"
COPY --from=server-build /aeliqo-server /aeliqo-server
COPY --from=build /src/dist /srv/aeliqo
WORKDIR /srv/aeliqo
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/aeliqo-server"]
