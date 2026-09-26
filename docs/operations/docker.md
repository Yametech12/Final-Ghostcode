# Docker & container deployment

> Last verified: 2026-09-26 · baseline commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f`

The application normally deploys to Vercel as serverless functions. This document
covers the **portable container image**, which runs the Express API as a
long-lived process so the same artifact can run locally, in CI, on Cloud Run, on
AWS Fargate, or on a plain VPS.

---

## 1. Why a container at all

| Concern | Vercel (serverless) | Docker image |
|---|---|---|
| Process model | Per-request function invocation, cold starts | One long-running Node process |
| Entry point | `api/server.ts` (Vercel adapter) | `api/_index.ts` → compiled `dist-server/api/_index.js` |
| Local parity | `npm run dev` (Express + Vite) | Same image as production |
| Rate-limit / cache state | Resets per invocation | Survives in memory while the container lives |
| Long-lived streaming | Capped by function `maxDuration: 60` | No platform cap (SSE `/api/advisor/chat`) |
| Cold starts | Yes | None while warm |
| Scaling | Automatic per request | Manual / platform-managed (replicas) |

**Key difference:** the Vercel path routes `/api/(.*)` to `api/server.ts` via
`vercel.json` rewrites. The container runs `api/_index.ts`, which registers the
same 16 routes on a real Express app. Both share the identical handler module,
so behaviour is the same — but the container has no rewrite layer, and
`vercel.json` is inert inside the image.

---

## 2. Where the image runs

```
                    ┌───────────────────────────────┐
                    │   ghostcode-api:<tag>         │
                    │   (node:20-alpine, non-root)  │
                    │                               │
                    │  dist/          SPA assets    │
                    │  dist-server/   compiled API  │
                    │  node_modules/  server closure│
                    └───────────────┬───────────────┘
                                    │  node dist-server/api/_index.js  :3000
        ┌───────────────┬───────────┼───────────┬────────────────┐
        ▼               ▼           ▼           ▼                ▼
   local dev      GitHub Actions  Cloud Run   AWS Fargate      VPS
   docker         (docker.yml)    (managed)   (managed)        (systemd /
   compose                        autoscale   autoscale        docker run)
        │               │
        │               └── smoke test: 5x GET /api/health == 200
        │
        └── docker compose up api redis  →  http://localhost:3000
```

The image is self-contained: it serves the SPA from `dist/` via
`express.static` (only when `NODE_ENV=production`) and exposes the API on the
same port, so there is no separate reverse proxy requirement for a single-node
deployment.

---

## 3. Build and run

```bash
# Build
docker build -t ghostcode-api:latest .

# Run (env from .env; server exits 1 without the two required vars)
docker run --rm -p 3000:3000 --env-file .env ghostcode-api:latest

# Verify
curl -s http://localhost:3000/api/health
# → {"status":"ok","env":"production","regolo":false,"aiProvider":"Regolo AI","timestamp":"..."}
```

With Compose:

```bash
cp .env.example .env      # then fill VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
docker compose up api
# or, starting the Redis sidecar too:
docker compose up api redis
```

The dev variant (Vite HMR on 5173 + Express on 3000, dev deps present, runs as
root — **never production**):

```bash
docker build -f Dockerfile.alpine-dev -t ghostcode-api:dev .
docker run --rm -p 3000:3000 -p 5173:5173 -v "$PWD/src:/app/src" \
  --env-file .env ghostcode-api:dev
```

---

## 4. Smoke test

`scripts/docker-smoke.sh` boots the image, polls `GET /api/health` five times,
asserts five `200`s, prints the image size, and tears the container down. Any
failure exits non-zero and dumps container logs.

```bash
chmod +x scripts/docker-smoke.sh
scripts/docker-smoke.sh ghostcode-api:latest 5
```

It injects **dummy but well-formed** credentials. That is sufficient because
`api/_index.ts` exits(1) when `VITE_SUPABASE_URL` or
`SUPABASE_SERVICE_ROLE_KEY` is missing — proving the boot path — while
`handleHealth()` never dereferences the Supabase client, so no real backend is
contacted. The smoke test therefore works fully offline.

---

## 5. Image size budget

**Target: < 250 MB.**

Two things blow the budget if you use the naive `npm ci --omit=dev`:

1. **`@vercel/node` is a production dependency** (80 MB subtree). It is imported
   by `api/server.ts` as a *type-only* import, and that file is excluded from the
   server compile — so it is unreachable at runtime inside the container.
2. **Frontend libraries are declared in `dependencies`, not `devDependencies`.**
   `react`, `react-dom`, `recharts`, `motion`, `lucide-react`, `lenis`, `cmdk`,
   `sonner`, `zustand`, `@tanstack/react-query`, `react-router-dom`,
   `react-markdown`, `react-window` are runtime deps *for the browser*. Vite has
   already bundled them into `dist/`. `--omit=dev` keeps installing them.

Measured `node_modules` sizes (this build context):

| Approach | node_modules | Bytes |
|---|---|---|
| `npm ci --omit=dev` (naive) | 264.6 MB | 277,446,299 |
| …with `@vercel/node` moved to devDependencies | 141.0 MB | 147,894,015 |
| **`docker/package.server.json` (shipped approach)** | **43.8 MB** | **45,907,087** |

`docker/package.server.json` declares only the five packages the compiled API
actually imports — `express`, `helmet`, `@supabase/supabase-js`, `dotenv`,
`@sentry/node` — verified by reading the emitted `dist-server/**` import
statements. The repo's own `package.json` is **not modified**, so Vercel builds
and `npm ci` are unaffected.

> **Maintenance note:** `docker/package.server.json` is a hand-maintained
> manifest. If the API later imports a new runtime package, add it there or the
> container will crash at boot with `ERR_MODULE_NOT_FOUND`. The smoke test is
> what catches that — it boots the real image.

### Measured composition of the final image

Application layers (measured uncompressed, this build context):

| Layer | Bytes |
|---|---|
| `node_modules` (server closure) | 45,907,087 |
| `dist/` (SPA) | 2,349,348 |
| `dist-server/` (compiled API) | 113,418 |
| **App total** | **48,369,853 (46.1 MB)** |

Base image `node:20-alpine` linux/amd64: 4 layers, **48,356,157 bytes (46.1 MB) compressed**, digest
`sha256:afdf98210b07b586eb71fa22ba2e432e058e4cd1304d31ed60888755b8c865fb` (read from the Docker Hub
registry manifest — not from a local build).

**Exact `docker images` size: [UNVERIFIED].** The build could not be executed in the authoring
environment (see §12), and `docker images` reports *uncompressed* bytes, whereas the base figure above
is *compressed*. A conservative bound: uncompressed `node:20-alpine` is roughly 130–150 MB, so the
final image lands near **180–200 MB** — within the 250 MB budget with margin. Confirm with:

```bash
docker build -t ghostcode-api:latest . && docker images ghostcode-api:latest
```

Base layer: `node:20-alpine` (linux/amd64, digest
`sha256:afdf98210b07b586eb71fa22ba2e432e058e4cd1304d31ed60888755b8c865fb`),
4 compressed layers totalling 48,356,157 bytes (46.1 MB).

---

## 6. Multi-stage rationale

| Stage | Base | Purpose | Ends up in the final image? |
|---|---|---|---|
| `builder` | node:20-alpine | `npm ci` (all deps), `vite build`, `tsc -p tsconfig.server.json` | No — only `dist/`, `dist-server/` are copied out |
| `server-deps` | node:20-alpine | Install the 5-package server closure | Only its `node_modules` |
| `runtime` | node:20-alpine | Serve the app | Yes |

Consequences: no compiler, no bundler, no test runner, no source `.ts` in the
final image; the build toolchain never inflates the runtime layer; and the
dependency layer is cached independently of source changes.

---

## 7. Security posture

**Non-root.** The runtime stage ends with `USER node` (uid 1000, shipped by the
node image). Every `COPY` uses `--chown=node:node`, and the `/app/dist` symlink
uses `chown -h` so the link itself is owned by `node`. No `USER root` appears in
either Dockerfile.

**No secrets in layers.** `.dockerignore` excludes `.env`, `.env.*` (except
`.env.example`), `*.pem`, `*.key`, `*.p12`. Environment comes from
`--env-file` / platform secret injection at runtime, never baked into an image
layer. Note the existing build-time secret-leak guard in `vite.config.ts` still
applies — it fails the build if a `VITE_`-prefixed secret would be inlined.

**No new production dependencies.** The container adds zero packages beyond the
five already declared in the repo. The full repo test suite remains green.

**Vulnerability scanning:**

```bash
docker scout cves ghostcode-api:latest
docker scout recommendations ghostcode-api:latest
# or
trivy image --severity HIGH,CRITICAL ghostcode-api:latest
```

**Recommended runtime flags:**

```bash
docker run --rm -p 3000:3000 --env-file .env \
  --read-only --tmpfs /tmp \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  ghostcode-api:latest
```

The image writes nothing to disk at runtime, so `--read-only` is safe.

---

## 8. Environment variables

Required (the server calls `process.exit(1)` without them):

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | Server-side use — the name is historically inconsistent but the API reads this exact key |
| `SUPABASE_SERVICE_ROLE_KEY` | Must not be a placeholder; the server rejects `your_`/`changeme`-style values |

Optional / platform:

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `production` | `production` also enables `express.static` for the SPA |
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | Set in the image; keep `0.0.0.0` in a container |
| `APP_URL` | — | **Must be the browser-facing URL**, not the container hostname. CORS echoes `Origin` against it |
| `REGOLO_API_KEY` | — | Absent ⇒ `/api/health` reports `regolo: false` and AI features are disabled |
| `SENTRY_DSN` | — | Optional; Sentry init is a no-op without it |
| `REDIS_URL` | — | Declared in compose for the planned cache migration; **not consumed by the app yet** |

---

## 9. CI integration

`.github/workflows/docker.yml` is separate from the application CI. It builds
with BuildKit + GitHub Actions layer cache, runs `scripts/docker-smoke.sh` (5×
`/api/health`), publishes the image size to the job summary, and pushes to
`ghcr.io/<owner>/<repo>` on `v*` tags (`semver`, `sha-*`, `latest`).

```bash
docker pull ghcr.io/yametech12/final-ghostcode:latest
```

---

## 10. Caveats

- **`vercel.json` does not apply.** Its rewrites, `maxDuration`, and `headers`
  block are platform config. Security headers are still applied in-process by
  `applySecurityHeaders()` in `api/lib/http.ts`, so the container is not
  unprotected — but anything relying solely on `vercel.json` (e.g. cache-control
  for `/fonts/*`) must be re-created at your reverse proxy or CDN.
- **Set `APP_URL` correctly**, or browser requests from the real origin fail the
  CORS check. Use the externally reachable URL, never `http://localhost` in
  production or the container's service name.
- **State is per-process.** Rate limiting (`_index.ts` Map), the auth token cache
  (`api/lib/auth.ts`), and the tier cache (`api/lib/tierGate.ts`) live in memory.
  With multiple replicas each holds its own — limiting is approximate. Move to
  Redis/Upstash before scaling horizontally.
- **Supabase is still external.** The image does not bundle a database; a
  reachable Supabase project is required for any route other than `/api/health`.
- **`api/server.ts` is not in the image.** It is the Vercel adapter and is
  excluded from `tsconfig.server.json`. The container entry is
  `dist-server/api/_index.js`.

---

## 11. Files

| File | Purpose |
|---|---|
| `Dockerfile` | Production multi-stage build |
| `Dockerfile.alpine-dev` | Dev image (Vite HMR + API) |
| `docker/package.server.json` | Minimal server dependency closure |
| `.dockerignore` | Excludes secrets, VCS, build output, dev tooling |
| `docker-compose.yml` | `api` + `redis` local stack |
| `scripts/docker-smoke.sh` | Boot + 5× health assertion |
| `tsconfig.server.json` | Emit config for the API (repo had typecheck-only config) |
| `.github/workflows/docker.yml` | Build, smoke, publish to GHCR |
