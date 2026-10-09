#!/usr/bin/env bash
#
# server-setup.sh — run this ON THE cPanel SERVER (in Terminal), from the
# backend/ folder, AFTER you have:
#   1. git pull'd the latest code
#   2. uploaded the compiled frontend into backend/public/ (index.html + app/)
#
# It installs PHP deps, prepares .env, runs migrations, and caches config.
# It does NOT need Node/npm on the server — the SPA is built locally and
# uploaded.
#
# Usage:
#   cd ~/selectpic-magicframes/backend
#   bash server-setup.sh
#
set -euo pipefail

info()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m!! \033[0m %s\n' "$1"; }
die()   { printf '\033[1;31mERROR:\033[0m %s\n' "$1"; exit 1; }

# Must run from the Laravel app root (where artisan lives).
[[ -f artisan ]] || die "Run this from the backend/ folder (artisan not found here)."

# --- Pick a PHP 8.3 binary ---------------------------------------------------
PHP_BIN="php"
if ! "$PHP_BIN" -v >/dev/null 2>&1; then
  for cand in /opt/alt/php83/usr/bin/php /usr/local/bin/ea-php83 ea-php83; do
    if command -v "$cand" >/dev/null 2>&1 || [[ -x "$cand" ]]; then PHP_BIN="$cand"; break; fi
  done
fi
info "Using PHP: $("$PHP_BIN" -v 2>/dev/null | head -1)"

# --- Pick a Composer binary --------------------------------------------------
COMPOSER_BIN=""
if command -v composer >/dev/null 2>&1; then
  COMPOSER_BIN="composer"
elif [[ -f /opt/cpanel/composer/bin/composer ]]; then
  COMPOSER_BIN="$PHP_BIN -d memory_limit=-1 /opt/cpanel/composer/bin/composer"
else
  die "Composer not found. Install it or set COMPOSER_BIN manually."
fi
info "Using Composer: $COMPOSER_BIN"

# --- 1. Install PHP dependencies (no dev, optimized) -------------------------
info "Installing PHP dependencies…"
eval "$COMPOSER_BIN install --no-dev --optimize-autoloader --no-interaction"

# --- 2. Prepare .env ---------------------------------------------------------
if [[ ! -f .env ]]; then
  info "Creating .env from the production template…"
  cp .env.production.example .env
  warn "Edit .env now and set DB_PASSWORD and your Google Drive credentials."
  warn "DB_DATABASE/DB_USERNAME default to uddjzwrz_selectpic."
fi

# Generate APP_KEY only if it's empty.
if grep -qE '^APP_KEY=$' .env; then
  info "Generating APP_KEY…"
  "$PHP_BIN" artisan key:generate --force
else
  info "APP_KEY already set — skipping."
fi

# --- 3. Warn if the SPA hasn't been uploaded ---------------------------------
if [[ ! -f public/index.html ]]; then
  warn "public/index.html is missing — upload the frontend build (index.html + app/)."
  warn "Build locally with:  cd frontend && npm ci && npm run build"
fi

# --- 4. Migrate --------------------------------------------------------------
info "Running database migrations…"
if ! "$PHP_BIN" artisan migrate --force; then
  warn "Migration failed — check DB_* values in .env (database, username, password, privileges)."
fi

# --- 5. Cache & permissions --------------------------------------------------
info "Caching config, routes and views…"
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

info "Fixing storage/bootstrap permissions…"
chmod -R ug+rwx storage bootstrap/cache

info "Done. Visit https://selectpic.magicframes.nokkoo.in/ to verify."
info "API check: https://selectpic.magicframes.nokkoo.in/api/projects  -> {\"data\":[]}"
