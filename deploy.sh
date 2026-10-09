#!/usr/bin/env bash
#
# deploy.sh — build the SPA and package the app into an upload-ready archive
# for cPanel (selectpic.magicframes.nokkoo.in).
#
# This does NOT touch your server (no SSH). It produces a zip you upload via
# cPanel File Manager / SFTP, then you run the server-side steps in
# DEPLOYMENT.md (composer install --no-dev, php artisan migrate --force, caching).
#
# Usage:
#   ./deploy.sh                 # Layout A: app with public/ subfolder (default)
#   ./deploy.sh --layout b      # Layout B: split into app/ + docroot/
#
# Layout A (recommended): point the cPanel doc root at the app's public/ dir.
# Layout B: doc root is fixed; app lives outside it, public/ contents go in root.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
DIST_DIR="$ROOT_DIR/dist-deploy"
STAMP="$(date +%Y%m%d-%H%M%S)"

LAYOUT="a"
if [[ "${1:-}" == "--layout" ]]; then
  LAYOUT="$(echo "${2:-a}" | tr '[:upper:]' '[:lower:]')"
fi

info()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m!! \033[0m %s\n' "$1"; }

# --- Preconditions ----------------------------------------------------------
command -v npm >/dev/null  || { echo "npm not found"; exit 1; }

# --- 1. Build the SPA into backend/public -----------------------------------
info "Building frontend (production)…"
cd "$FRONTEND_DIR"
if [[ -d node_modules ]]; then
  npm run build
else
  npm ci && npm run build
fi

[[ -f "$BACKEND_DIR/public/index.html" ]] || { echo "SPA build missing index.html"; exit 1; }

# --- 2. Stage the Laravel app (excluding dev-only cruft) --------------------
info "Staging application files…"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# rsync keeps this readable; falls back to cp if rsync is unavailable.
STAGE="$DIST_DIR/app"
mkdir -p "$STAGE"
EXCLUDES=(
  --exclude ".git"
  --exclude "node_modules"
  --exclude "vendor"
  --exclude ".env"
  --exclude ".env.backup"
  --exclude "storage/logs/*"
  --exclude "tests"
  --exclude ".phpunit.result.cache"
)
if command -v rsync >/dev/null; then
  rsync -a "${EXCLUDES[@]}" "$BACKEND_DIR/" "$STAGE/"
else
  cp -a "$BACKEND_DIR/." "$STAGE/"
  rm -rf "$STAGE/.git" "$STAGE/node_modules" "$STAGE/vendor" "$STAGE/.env" "$STAGE/tests"
  find "$STAGE/storage/logs" -type f ! -name ".gitignore" -delete 2>/dev/null || true
fi

# Ship the production env template as a starting point.
cp "$BACKEND_DIR/.env.production.example" "$STAGE/.env.production.example"

# --- 3. Arrange per layout --------------------------------------------------
if [[ "$LAYOUT" == "a" ]]; then
  info "Layout A: single folder; point cPanel doc root at app/public/"
  ARCHIVE="$DIST_DIR/selectpic-deploy-A-$STAMP.zip"
  ( cd "$DIST_DIR" && zip -rq "$ARCHIVE" "app" )
  cat <<EOF

Layout A package ready:
  $ARCHIVE

Upload & extract so the app lives at e.g. /home/uddjzwrz/apps/selectpic,
then set the subdomain doc root to that app's /public folder.
EOF
else
  info "Layout B: split into app/ (outside doc root) + docroot/ (public contents)"
  DOCROOT="$DIST_DIR/docroot"
  mkdir -p "$DOCROOT"
  # Move public/ contents to the docroot, leave the app without a public/.
  cp -a "$STAGE/public/." "$DOCROOT/"
  rm -rf "$STAGE/public"

  # Rewrite index.php require paths to point up one level into ../apps/selectpic.
  # Adjust APP_REL if you place the app somewhere else relative to the doc root.
  APP_REL="../apps/selectpic"
  sed -i.bak \
    -e "s#__DIR__\.'/../vendor/autoload.php'#__DIR__.'/$APP_REL/vendor/autoload.php'#" \
    -e "s#__DIR__\.'/../bootstrap/app.php'#__DIR__.'/$APP_REL/bootstrap/app.php'#" \
    -e "s#__DIR__\.'/../storage/framework/maintenance.php'#__DIR__.'/$APP_REL/storage/framework/maintenance.php'#" \
    "$DOCROOT/index.php"
  rm -f "$DOCROOT/index.php.bak"

  ARCHIVE="$DIST_DIR/selectpic-deploy-B-$STAMP.zip"
  ( cd "$DIST_DIR" && zip -rq "$ARCHIVE" "app" "docroot" )
  cat <<EOF

Layout B package ready:
  $ARCHIVE

Contents:
  app/      -> upload OUTSIDE the doc root, e.g. /home/uddjzwrz/apps/selectpic
  docroot/  -> upload its contents INTO /home/uddjzwrz/selectpic.magicframes.nokkoo.in
index.php has been rewritten to require ../apps/selectpic — change APP_REL in
deploy.sh if you place the app elsewhere.
EOF
fi

cat <<'EOF'

Next, on the server (see DEPLOYMENT.md):
  cp .env.production.example .env   # then edit DB_* and GOOGLE_* secrets
  php artisan key:generate
  composer install --no-dev --optimize-autoloader
  php artisan migrate --force
  php artisan config:cache && php artisan route:cache && php artisan view:cache
  chmod -R ug+rwx storage bootstrap/cache
EOF

info "Done."
