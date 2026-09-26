#!/usr/bin/env sh
# =============================================================================
# scripts/docker-smoke.sh — verify a built image before deploying it.
#
# Boots the image, polls /api/health N times, asserts every response is 200,
# then tears the container down. Exits non-zero on the first failure so CI
# stops immediately.
#
# Usage:
#   scripts/docker-smoke.sh [IMAGE] [ATTEMPTS]
#   scripts/docker-smoke.sh ghostcode-api:latest 5
#
# Required env (dummy values are fine — see the note below):
#   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#
# WHY DUMMY CREDENTIALS ARE ENOUGH: api/_index.ts exits(1) when either variable
# is absent, but /api/health (handleHealth) never dereferences the Supabase
# client — it only reports NODE_ENV and whether REGOLO_API_KEY is set. A
# syntactically valid dummy URL therefore proves the boot path, the route table
# and the middleware chain without any real backend.
# =============================================================================
set -eu

IMAGE="${1:-ghostcode-api:latest}"
ATTEMPTS="${2:-5}"
HOST_PORT="${SMOKE_PORT:-18080}"
CONTAINER="ghostcode-smoke-$$"
NAME="$(basename "$IMAGE" | tr ':.' '--')"

# Dummy but well-formed. Never real credentials.
: "${VITE_SUPABASE_URL:=https://smoke-test.supabase.co}"
: "${SUPABASE_SERVICE_ROLE_KEY:=smoke-test-service-role-key-not-real}"
export VITE_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "== docker-smoke =============================================="
echo "image     : $IMAGE"
echo "container : $CONTAINER"
echo "port      : $HOST_PORT -> 3000"
echo "attempts  : $ATTEMPTS"
echo "=============================================================="

echo "[1/4] image present"
docker image inspect "$IMAGE" >/dev/null 2>&1 || {
  echo "FAIL: image '$IMAGE' not found locally. Build it first:"
  echo "      docker build -t $IMAGE ."
  exit 1
}
SIZE_BYTES="$(docker image inspect "$IMAGE" --format '{{.Size}}')"
SIZE_MB="$(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.1f", b/1048576 }')"
echo "      size: ${SIZE_MB} MB"

echo "[2/4] starting container"
docker run -d --name "$CONTAINER" \
  -p "127.0.0.1:${HOST_PORT}:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  -e VITE_SUPABASE_URL \
  -e SUPABASE_SERVICE_ROLE_KEY \
  "$IMAGE" >/dev/null

echo "[3/4] waiting for /api/health"
READY=0
i=1
while [ "$i" -le 30 ]; do
  if docker exec "$CONTAINER" wget -q -O - http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  # Surface a crash instead of waiting out the full timeout.
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
    echo "FAIL: container exited during startup. Logs:"
    docker logs "$CONTAINER" 2>&1 | tail -40
    exit 1
  fi
  sleep 1
  i=$((i + 1))
done

if [ "$READY" -ne 1 ]; then
  echo "FAIL: /api/health never became ready after 30s. Logs:"
  docker logs "$CONTAINER" 2>&1 | tail -40
  exit 1
fi
echo "      ready after ${i}s"

echo "[4/4] $ATTEMPTS x GET /api/health"
PASS=0
FAILED=0
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  # curl from the host so the published port is exercised too.
  BODY="$(curl -sS -m 5 -w '\n%{http_code} %{time_total}' "http://127.0.0.1:${HOST_PORT}/api/health" 2>&1 || true)"
  CODE="$(printf '%s' "$BODY" | tail -n1 | awk '{print $1}')"
  TIME="$(printf '%s' "$BODY" | tail -n1 | awk '{print $2}')"
  J="$(printf '%s' "$BODY" | sed '$d')"
  if [ "$CODE" = "200" ]; then
    PASS=$((PASS + 1))
    echo "      run $i/$ATTEMPTS: HTTP $CODE in ${TIME}s -> $J"
  else
    FAILED=$((FAILED + 1))
    echo "      run $i/$ATTEMPTS: HTTP ${CODE:-none} (expected 200)"
  fi
  i=$((i + 1))
done

echo "=============================================================="
echo "RESULT: $PASS/$ATTEMPTS passed, $FAILED failed, image size ${SIZE_MB} MB"

if [ "$FAILED" -ne 0 ]; then
  echo "FAIL: smoke test did not pass $ATTEMPTS/$ATTEMPTS"
  docker logs "$CONTAINER" 2>&1 | tail -30
  exit 1
fi

echo "PASS: smoke test $PASS/$ATTEMPTS"
exit 0
