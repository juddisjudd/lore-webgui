# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM oven/bun:1.4.0 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/api/package.json packages/api/
COPY packages/gateway/package.json packages/gateway/
COPY packages/web/package.json packages/web/
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN cd packages/web && bun --bun x svelte-kit sync && bun --bun x vite build
RUN cd packages/gateway && bun run bundle

FROM oven/bun:1.4.0-distroless
WORKDIR /app

COPY --from=build /app/packages/gateway/dist/gateway.js ./gateway.js
COPY --from=build /app/packages/web/build ./public
COPY LICENSE ./

ENV PORT=7337 \
    STATIC_DIR=/app/public
EXPOSE 7337

USER 65532:65532

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/usr/local/bin/bun", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["gateway.js"]
