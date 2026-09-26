#!/usr/bin/env bash
#
# check-security-headers.sh — verifies that a DEPLOYED Epimetheus origin really
# ships the security headers declared in vercel.json.
#
# A green `npm run build` proves nothing here: the headers are attached by
# Vercel's routing layer, so the only honest check is to ask the live site.
#
# Usage:
#   bash scripts/check-security-headers.sh                        # default prod alias
#   bash scripts/check-security-headers.sh https://epimetheus.ai
#   VERIFY_URL=my-preview-abc.vercel.app bash scripts/check-security-headers.sh
#   USE_HEAD=1 bash scripts/check-security-headers.sh             # force HTTP HEAD
#
# Exit codes:
#   0  every required header present and correct
#   1  at least one assertion failed
#   2  network/usage error (no response from the target)

set -euo pipefail

RAW_URL="${1:-${VERIFY_URL:-epimetheusproject.vercel.app}}"
case "$RAW_URL" in
  http://*|https://*) URL="$RAW_URL" ;;
  *) URL="https://$RAW_URL" ;;
esac

# The app shell is the document the browser executes policy against. Prefer a
# GET with headers dumped (-D -) — some edges rewrite headers on HEAD.
if [ "${USE_HEAD:-0}" = "1" ]; then
  HEADERS="$(curl -sSI --max-time 20 "$URL" 2>/dev/null || true)"
else
  HEADERS="$(curl -sS -D - -o /dev/null --max-time 20 "$URL" 2>/dev/null || true)"
fi

if [ -z "$HEADERS" ]; then
  echo "ERROR: no response from $URL (DNS, TLS or network failure)" >&2
  exit 2
fi

FAILED=0
pass() { printf '  [ OK ] %s\n' "$1"; }
fail() { printf '  [FAIL] %s\n' "$1"; FAILED=$((FAILED + 1)); }

# has_header <name> <regex-on-full-header-line>
has_header() {
  if printf '%s' "$HEADERS" | grep -qiE "$2"; then pass "$1"; else fail "$1 — missing"; fi
}

# header_value <name>
header_value() {
  printf '%s' "$HEADERS" | tr -d '\r' | grep -i "^$1:" | head -n1 | sed 's/^[^:]*:[[:space:]]*//'
}

echo "Checking security headers on $URL"
echo
echo "-- transport / framing ------------------------------------------"
has_header "Strict-Transport-Security present" '^strict-transport-security:'
has_header "Strict-Transport-Security max-age >= 1 year" '^strict-transport-security:.*max-age=31536000'
has_header "X-Frame-Options present" '^x-frame-options:'
has_header "X-Content-Type-Options present" '^x-content-type-options:'
has_header "Referrer-Policy present" '^referrer-policy:'
has_header "Permissions-Policy present" '^permissions-policy:'

XFO="$(header_value 'X-Frame-Options' || true)"
if [ "${XFO:-}" = "DENY" ]; then pass "X-Frame-Options is DENY"; else fail "X-Frame-Options is '${XFO:-none}', expected DENY"; fi

XCTO="$(header_value 'X-Content-Type-Options' || true)"
if [ "${XCTO:-}" = "nosniff" ]; then pass "X-Content-Type-Options is nosniff"; else fail "X-Content-Type-Options is '${XCTO:-none}', expected nosniff"; fi

echo
echo "-- content security policy --------------------------------------"
has_header "Content-Security-Policy present" '^content-security-policy:'

CSP="$(header_value 'Content-Security-Policy' || true)"
if [ -n "$CSP" ]; then
  for pair in \
    "default-src 'self'" \
    "script-src" \
    "frame-ancestors 'none'" \
    "object-src 'none'" \
    "base-uri 'self'" \
    "form-action 'self'"
  do
    if printf '%s' "$CSP" | grep -qF -- "$pair"; then pass "CSP contains $pair"; else fail "CSP missing: $pair"; fi
  done

  # script-src must not carry 'unsafe-inline' (style-src legitimately does).
  if printf '%s' "$CSP" | grep -qi "script-src[^;]*'unsafe-inline'"; then
    fail "script-src contains 'unsafe-inline' — the whole point of this fix"
  else
    pass "script-src has no 'unsafe-inline'"
  fi
  echo
  echo "  CSP: $CSP"
fi

echo
echo "-- serverless API (informational) -------------------------------"
API_HEADERS="$(curl -sS -D - -o /dev/null --max-time 20 "$URL/api/health" 2>/dev/null || true)"
if [ -z "$API_HEADERS" ]; then
  echo "  [skip] /api/health unreachable"
elif printf '%s' "$API_HEADERS" | grep -qiE '^content-security-policy:'; then
  echo "  [ OK ] /api/health also returns a CSP"
else
  echo "  [warn] /api/health returned no CSP (function-side headers changed?)"
fi

echo
if [ "$FAILED" -ne 0 ]; then
  echo "RESULT: FAILED — $FAILED check(s) failed on $URL"
  exit 1
fi
echo "RESULT: PASSED — all required security headers present on $URL"
exit 0
