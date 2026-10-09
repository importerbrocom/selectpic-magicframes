# frontend-dist — prebuilt SPA for Node-less servers

This folder holds the **compiled** React frontend (production build) so it can be
deployed on hosts that don't have Node/npm (e.g. shared cPanel) via `git pull`
alone — no local build or manual upload required.

## Deploy on the server

From the repo root on the server:

```bash
git pull
cp -a frontend-dist/index.html frontend-dist/app frontend-dist/favicon.svg frontend-dist/icons.svg backend/public/
php artisan --working-dir=backend config:cache   # optional; config unchanged
```

(Or copy into whatever directory your document root serves, if different.)

## Regenerating (maintainers only)

Rebuild from source and refresh this folder:

```bash
cd frontend && npm run build          # outputs into ../backend/public
cd ..
rm -rf frontend-dist && mkdir -p frontend-dist
cp -a backend/public/index.html backend/public/app \
      backend/public/favicon.svg backend/public/icons.svg frontend-dist/
```

The hashed filenames under `app/` change every build; always copy the whole
`app/` folder so stale bundles don't linger.
