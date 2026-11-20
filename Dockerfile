# Danse Macabre in a container. No keys, no network at run time.
#   docker build -t danse-macabre .                      the app on http://127.0.0.1:8080 (target demo, the default)
#   docker build -t danse-mcp --target mcp .             the MCP server on stdio, for an agent
# compose.yaml runs either one.

FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/mcp/package.json packages/mcp/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY web web
COPY data data
COPY examples examples
RUN pnpm --filter @danse/web build

# The MCP server: the notation engine as tools, reading the clips in data/clips. Files it writes land in /app/out.
FROM deps AS mcp
COPY packages packages
COPY data data
COPY examples examples
RUN mkdir -p /app/out && chown node:node /app/out
USER node
ENV DANSE_WORKSPACE=/app
CMD ["node", "--import", "tsx", "packages/mcp/src/bin.ts"]

# The app, served as static files by an unprivileged nginx on port 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS demo
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
