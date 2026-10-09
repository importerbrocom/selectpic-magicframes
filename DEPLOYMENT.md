# Deploying to cPanel — selectpic.magicframes.nokkoo.in

Single-domain deployment: the React app is built into Laravel's `public/` and
served from the same domain, with the API under `/api`. PHP 8.3.

- **Domain:** `selectpic.magicframes.nokkoo.in`
- **Doc root:** `/home/uddjzwrz/selectpic.magicframes.nokkoo.in`
- **Database:** `uddjzwrz_selectpic`

> **Security:** rotate the database password you shared earlier, and never
> commit the real `.env`. The password lives only in `.env` on the server.

---

## 0. Build the frontend (locally, before uploading)

The compiled SPA must be built and uploaded as part of `backend/public/`.

```bash
cd frontend
npm ci
npm run build          # outputs into ../backend/public (index.html + app/)
```

This uses `.env.production` (empty `VITE_API_BASE_URL`) so the app calls the
same origin at `/api`.

---

## 1. Choose your layout

cPanel points the subdomain's document root at a fixed folder. Laravel expects
the web server to serve its `public/` folder, **not** the project root. Pick
whichever matches what your cPanel lets you do:

### Layout A — point the doc root at Laravel's `public/` (recommended)

If you can set the subdomain's document root in cPanel, point it at a `public`
subfolder, e.g. upload the project to
`/home/uddjzwrz/apps/selectpic` and set the doc root to
`/home/uddjzwrz/apps/selectpic/public`. Nothing else to change.

### Layout B — fixed doc root (can't change it)

If the doc root is locked to `/home/uddjzwrz/selectpic.magicframes.nokkoo.in`:

1. Upload the Laravel app to a folder **outside** the doc root, e.g.
   `/home/uddjzwrz/apps/selectpic` (so `vendor/`, `app/`, `.env`, etc. are not
   web-accessible).
2. Copy the **contents** of that app's `public/` into the doc root
   `/home/uddjzwrz/selectpic.magicframes.nokkoo.in/`.
3. Edit the copied `index.php` in the doc root so its two `require` paths point
   up at the app folder:

   ```php
   // was: __DIR__.'/../vendor/autoload.php'
   require __DIR__.'/../apps/selectpic/vendor/autoload.php';

   // was: __DIR__.'/../bootstrap/app.php'
   $app = require_once __DIR__.'/../apps/selectpic/bootstrap/app.php';
   ```

   (Adjust the relative path to wherever you placed the app.)

---

## 2. Upload

Upload everything **except** `vendor/` and `node_modules/` (you'll install
`vendor/` on the server). Easiest via cPanel File Manager (zip → upload →
extract) or SFTP. Make sure `backend/public/index.html` and `backend/public/app/`
(the built SPA) are included.

---

## 3. Create the database (cPanel → MySQL Databases)

1. Create database `uddjzwrz_selectpic` (likely already done).
2. Create a MySQL **user** and set a strong password.
3. Add the user to the database with **ALL PRIVILEGES**.
4. Note the exact user name — on cPanel it is usually prefixed, e.g.
   `uddjzwrz_dbuser`.

---

## 4. Configure `.env`

On the server, in the Laravel app folder:

```bash
cp .env.production.example .env
php artisan key:generate      # fills APP_KEY
```

Then edit `.env` and set:

- `DB_USERNAME` — the MySQL user you created in step 3
- `DB_PASSWORD` — the (rotated) password
- `GOOGLE_SERVICE_ACCOUNT_JSON` **or** `GOOGLE_DRIVE_API_KEY`

If the cPanel PHP CLI isn't on your PATH, use the full path, e.g.
`/usr/local/bin/ea-php83 artisan key:generate` (check cPanel → "Select PHP
Version" / MultiPHP for the exact binary).

---

## 5. Install dependencies & migrate

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
```

If Composer isn't available over SSH, use cPanel's Terminal, or run
`composer install` locally and upload the resulting `vendor/` folder.

---

## 6. Optimize & set permissions

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache

chmod -R ug+rwx storage bootstrap/cache
```

> Re-run `php artisan config:cache` after any `.env` change, and
> `php artisan optimize:clear` if you need to flush all caches.

---

## 7. Verify

- `https://selectpic.magicframes.nokkoo.in/` → the SPA loads.
- `https://selectpic.magicframes.nokkoo.in/api/projects` → `{"data":[]}`.
- `https://selectpic.magicframes.nokkoo.in/up` → health check `200`.
- HTTPS is enforced (`APP_URL` is `https://…`). Enable AutoSSL in cPanel if the
  cert isn't already issued.

---

## Updating later

```bash
# locally
cd frontend && npm run build        # rebuild SPA into backend/public
# upload changed files, then on the server:
composer install --no-dev --optimize-autoloader   # if backend deps changed
php artisan migrate --force
php artisan optimize                               # re-cache config/routes/views
```

---

## Google Drive credentials

The gallery stays empty until Drive access is configured on the server:

- **Service account (private folders):** create one in Google Cloud, enable the
  Drive API, download the JSON key, upload it **outside** the doc root (e.g.
  `/home/uddjzwrz/apps/selectpic/storage/google/service-account.json`), and set
  `GOOGLE_SERVICE_ACCOUNT_JSON` to that absolute path. Share each Drive folder
  with the service account's email.
- **API key (public folders only):** create a key with the Drive API enabled and
  set `GOOGLE_DRIVE_API_KEY`. Only works for folders shared as "anyone with the
  link".
