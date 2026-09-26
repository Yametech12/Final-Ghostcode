# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Epimetheus API + SPA (Final-Ghostcode).
#
# Runtime target: the long-running Express process (api/_index.ts), NOT the
# Vercel serverless entry (api/server.ts). The Vercel function is deliberately
# excluded from the server compile — it imports @vercel/node, which exists only
# in the platform runtime.
#
# Build:  docker build -t ghostcode-api:latest .
# Run:    docker run --rm -p 3000:3000 --env-file .env ghostcode-api:latest
#
# Alpine note: node:20-alpine ships busybox `wget`, not `curl`. The HEALTHCHECK
# uses wget so the image needs no extra packages.
#
# ── WHY A SEPARATE SERVER MANIFEST ──────────────────────────────────────────
# `npm ci --omit=dev` is NOT enough here. Twelve frontend libraries (react,
# react-dom, recharts, motion, lucide-react, lenis, cmdk, sonner, zustand,
# @tanstack/react-query, react-router-dom, react-markdown, react-window) are
# declared in `dependencies`, not `devDependencies`, because they ship in the
# browser bundle. Vite has already compiled them into dist/, so a server image
# that installs them is carrying dead weight. Measured: `npm ci --omit=dev`
# yields a 277 MB node_modules; the server's real import closure is ~4x smaller.
#
# docker/package.server.json declares only what the compiled API actually
# imports (verified against the emitted dist-server output):
#   express, helmet, @supabase/supabase-js, dotenv, @sentry/node
# This does NOT modify the repo's package.json, so Vercel and `npm ci` are
# unaffected.

ARG NODE_VERSION=20

# =============================================================================
# Stage 1 — builder: ALL deps (vite + tsc need dev tooling), compile SPA + API.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Dependency layer — cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

# Source layer.
COPY . .

# 1. SPA -> /app/dist  (vite build + service-worker version stamp)
# 2. API -> /app/dist-server/api/**  (tsconfig.server.json, ESM/NodeNext)
#
# The repo's tsconfig.api.json is `"noEmit": true` — a typecheck-only config, so
# before this Dockerfile there was NO compiled API output at all. tsconfig.server
# adds the emit config; tsc is invoked directly so package.json stays untouched.
RUN npm run build \
 && npx tsc -p tsconfig.server.json

# =============================================================================
# Stage 2 — server-deps: only the Express API's real import closure.
# =============================================================================
FROM node:20-alpine AS server-deps

WORKDIR /app

COPY docker/package.server.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# =============================================================================
# Stage 3 — runtime: minimal, non-root, healthchecked.
# =============================================================================
FROM node:20-alpine AS runtime

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    GIT_SHA=${GIT_SHA} \
    BUILD_DATE=${BUILD_DATE}

# Server dependency closure only — no vite, no typescript, no tsx, no frontend.
COPY --from=server-deps --chown=node:node /app/node_modules ./node_modules

# Compiled API, then the Vite client bundle.
COPY --from=builder --chown=node:node /app/dist-server ./dist-server
COPY --from=builder --chown=node:node /app/dist ./dist

# package.json for `npm ls` / introspection only — no package manager runs at start.
COPY --from=builder --chown=node:node /app/package.json ./package.json

# api/_index.ts computes `express.static(path.join(__dirname, '../dist'))`.
# In the source tree __dirname=/app/api so '../dist' = /app/dist. After compiling,
# __dirname=/app/dist-server/api so '../dist' would resolve to
# /app/dist-server/dist. Symlink bridges the layout shift without patching source.
RUN ln -s /app/dist /app/dist-server/dist \
 && chown -h node:node /app/dist-server/dist

# Drop privileges — the node image ships uid 1000 `node` already.
USER node

EXPOSE 3000

# /api/health is public, needs no auth, and never touches Supabase: handleHealth()
# in api/lib/handlers.ts only reads REGOLO_API_KEY presence and NODE_ENV. Safe to
# poll from the container runtime.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:${PORT}/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "dist-server/api/_index.js"]
