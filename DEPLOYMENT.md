# Deploying to cPanel — selectpic.magicframes.nokkoo.in

Single-domain setup: the React app is built **on your computer** (you have npm)
and uploaded; Laravel serves it from the same domain, with the API under `/api`.
The server does **not** need Node/npm. Server is **PHP 8.3**.

- **Domain:** `selectpic.magicframes.nokkoo.in`
- **Doc root:** `/home/uddjzwrz/selectpic.magicframes.nokkoo.in`
- **Database / user:** `uddjzwrz_selectpic`

> **Security:** rotate the DB password you shared earlier, and never commit the
> real `.env`. The password lives only in `.env` on the server.

---

## Part A — On your computer (build the frontend)

You have npm locally, so build the SPA here and upload the output. Nothing to
install on the server.

```bash
git clone -b feature/photo-selection-app https://github.com/importerbrocom/selectpic-magicframes.git
cd selectpic-magicframes/frontend
npm ci
npm run build        # outputs into ../backend/public (index.html + app/ + icons)
```

This uses `frontend/.env.production` (empty `VITE_API_BASE_URL`) so the app
calls the same origin at `/api` — no CORS needed.

The build produces these files you'll upload in Part B step 3:

```
backend/public/index.html
backend/public/app/            (JS + CSS bundle)
backend/public/favicon.svg
backend/public/icons.svg
```

---

## Part B — On the server (cPanel Terminal)

### 1. Prepare the cPanel environment (one-time, in the cPanel UI)

- **Select PHP Version** → set `selectpic.magicframes.nokkoo.in` to **PHP 8.3**.
- **MySQL Databases** → confirm DB `uddjzwrz_selectpic` and its user exist, the
  user has **ALL PRIVILEGES**, and set/rotate the password.

### 2. Get the code

```bash
cd ~
# First time:
git clone -b feature/photo-selection-app https://github.com/importerbrocom/selectpic-magicframes.git
# Or if already cloned, just update:
cd ~/selectpic-magicframes && git pull
cd ~/selectpic-magicframes/backend
```

### 3. Upload the frontend build

Using cPanel **File Manager**, upload the four items from Part A into:

```
~/selectpic-magicframes/backend/public/
```

so you end up with `backend/public/index.html` and `backend/public/app/`.
(These are git-ignored on purpose, so they are not in the clone.)

### 4. Run the setup script

From `~/selectpic-magicframes/backend`:

```bash
bash server-setup.sh
```

It auto-detects PHP 8.3 and Composer, then:
- `composer install --no-dev --optimize-autoloader`
- creates `.env` from the template (if missing) and generates `APP_KEY`
- runs `php artisan migrate --force`
- caches config/routes/views and fixes `storage/` permissions

> On first run it creates `.env` and tells you to set secrets. Edit `.env`
> (`nano .env`): set `DB_PASSWORD` (and `GOOGLE_DRIVE_API_KEY` **or**
> `GOOGLE_SERVICE_ACCOUNT_JSON`), then run `bash server-setup.sh` again.
>
> `DB_DATABASE` and `DB_USERNAME` already default to `uddjzwrz_selectpic`.

If you prefer to run the steps manually instead of the script, see
**Manual steps** below.

### 5. Point the web server at `public/`

Laravel must be served from its `public/` folder. Pick one:

- **Preferred:** cPanel → **Domains** → set the document root for
  `selectpic.magicframes.nokkoo.in` to
  `/home/uddjzwrz/selectpic-magicframes/backend/public`.
- **Symlink (if you can't change the doc root):**
  ```bash
  rm -f ~/selectpic.magicframes.nokkoo.in            # remove old dir/symlink
  ln -s ~/selectpic-magicframes/backend/public ~/selectpic.magicframes.nokkoo.in
  ```
  Works only if the host follows symlinked doc roots; otherwise use the doc-root
  setting above, or the split-folder "Layout B" in the project README/`deploy.sh`.

### 6. Verify

- `https://selectpic.magicframes.nokkoo.in/` → the app loads
- `https://selectpic.magicframes.nokkoo.in/api/projects` → `{"data":[]}`
- `https://selectpic.magicframes.nokkoo.in/up` → health check `200`
- Enable **AutoSSL** in cPanel if HTTPS isn't active yet.

---

## Manual steps (instead of server-setup.sh)

```bash
cd ~/selectpic-magicframes/backend
composer install --no-dev --optimize-autoloader
cp .env.production.example .env         # first time only
php artisan key:generate
nano .env                               # set DB_PASSWORD + GOOGLE_* ; save
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
chmod -R ug+rwx storage bootstrap/cache
```

> If `composer` isn't found:
> `php -d memory_limit=-1 /opt/cpanel/composer/bin/composer install --no-dev --optimize-autoloader`
> If `php` is the wrong version, use the cPanel PHP 8.3 binary, e.g.
> `/opt/alt/php83/usr/bin/php artisan …`.

---

## Updating later

```bash
# On your computer: rebuild the SPA
cd selectpic-magicframes/frontend && npm run build
#   -> upload backend/public/index.html + app/ again via File Manager

# On the server:
cd ~/selectpic-magicframes && git pull
cd backend
composer install --no-dev --optimize-autoloader   # if backend deps changed
php artisan migrate --force
php artisan optimize                               # re-cache config/routes/views
```

---

## Google Drive credentials

The gallery stays empty until Drive access is configured in `.env` on the server:

- **Service account (private folders):** create one in Google Cloud, enable the
  Drive API, download the JSON key, upload it **outside** the doc root (e.g.
  `~/selectpic-magicframes/backend/storage/google/service-account.json`), and set
  `GOOGLE_SERVICE_ACCOUNT_JSON` to that absolute path. Share each Drive folder
  with the service account's email.
- **API key (public folders only):** create a key with the Drive API enabled and
  set `GOOGLE_DRIVE_API_KEY`. Works only for folders shared as "anyone with the
  link".

After editing `.env`, re-run `php artisan config:cache`.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `composer install` fails: *requires php >=8.4.1* | Old lock file. `git pull` the latest — the lock is pinned to PHP 8.3. |
| `Failed opening required .../vendor/autoload.php` | `composer install` hasn't run (or failed). Run it first. |
| `php artisan migrate` → *Access denied* | Wrong `DB_PASSWORD`, or the MySQL user lacks privileges on `uddjzwrz_selectpic`. |
| Blank page / 500 | Run `php artisan config:clear`, check `storage/logs/laravel.log`, ensure `storage` is writable. |
| Site shows cPanel default, not the app | Doc root isn't pointing at `backend/public` (see step 5). |
| Gallery empty after fetching | Google Drive credentials not set in `.env`. |
