#!/usr/bin/env bash
set -euo pipefail
# Runs only a newly-created localhost database; never reads the app's DB URL.
ROOT="$(realpath "$(dirname "$0")/../..")"
INITDB="$(realpath "$(command -v initdb)")"
PG_CTL="$(dirname "$INITDB")/pg_ctl"
STAGING="$(mktemp -d /tmp/jav-variant-tests.XXXXXX)"
PORT="${VARIANT_TEST_PORT:-55433}"
as_owner() { if [ "$(id -u)" = 0 ]; then runuser -u nobody -- "$@"; else "$@"; fi; }
if [ "$(id -u)" = 0 ]; then chown nobody "$STAGING"; fi
cleanup() { as_owner "$PG_CTL" -D "$STAGING/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$STAGING"; }
trap cleanup EXIT
as_owner "$INITDB" -D "$STAGING/data" -A trust --no-locale -U postgres > "$STAGING/init.log"
as_owner "$PG_CTL" -D "$STAGING/data" -l "$STAGING/server.log" -o "-p $PORT -k $STAGING -h 127.0.0.1" start
VARIANT_TEST_DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/postgres" "$ROOT/node_modules/.bin/vitest" run --root "$ROOT" src/test/variant-database.test.ts