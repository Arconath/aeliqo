ARG SOURCE_REVISION=unknown
ARG SDK_SOURCE_REVISION=unknown
ARG SDK_VERSION=unknown

# Build the workspace packages the relay consumes (@aeliqo/core, runtime, agent)
# then compile the relay itself.
FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS relay-build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json release-metadata.json ./
COPY packages ./packages
COPY apps/relay ./apps/relay
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile \
  && pnpm build:agent \
  && pnpm --dir apps/relay build \
  && test -f /workspace/apps/relay/dist/index.js

# Materialize a self-contained production tree: the relay package plus only its
# production dependencies. `--legacy` because this workspace does not enable
# inject-workspace-packages; the flag resolves workspace links into real dirs.
RUN pnpm --filter @aeliqo/relay deploy --prod --legacy /deploy \
  && test -f /deploy/dist/index.js \
  && test -f /deploy/node_modules/@aeliqo/agent/dist/mcp/index.js

FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf

ARG SOURCE_REVISION
ARG SDK_SOURCE_REVISION
ARG SDK_VERSION
LABEL org.opencontainers.image.source="https://github.com/Arconath/aeliqo"
LABEL org.opencontainers.image.description="Aeliqo hosted MCP relay (pair/attach/ack broker)"
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
LABEL com.aeliqo.sdk.revision="${SDK_SOURCE_REVISION}"
LABEL com.aeliqo.sdk.version="${SDK_VERSION}"

ENV NODE_ENV=production
ENV SOURCE_REVISION=${SOURCE_REVISION}
ENV PORT=8080

WORKDIR /app
COPY --from=relay-build /deploy ./

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
