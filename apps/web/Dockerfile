# syntax=docker/dockerfile:1.7
# Pullim Admissions Coach — apps/web (Next.js 14 standalone)
# Multi-stage build. Non-root. Pinned Node 20 LTS alpine for smaller surface.
# Image is built/pushed by .github/workflows/deploy-staging-web.yml.

# ──────────────────────────────────────────────
# 1) deps: install workspace deps once
# ──────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo

# pnpm via corepack (matches packageManager pin in root package.json)
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate

# Copy only manifests for cached install layer
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ──────────────────────────────────────────────
# 2) builder: produce Next.js standalone output
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY . .

# Activate standalone output in Linux build (Windows local dev disables it)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone

RUN pnpm --filter @pullim/web build

# ──────────────────────────────────────────────
# 3) runner: minimal runtime image
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3007
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone output (includes minimal node_modules + server.js)
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3007

# ALB target group health check should be GET / 200 (Phase A landing renders static).
# Future: switch to a dedicated /api/health endpoint when api service is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3007/ || exit 1

# Next.js standalone entrypoint
CMD ["node", "apps/web/server.js"]
