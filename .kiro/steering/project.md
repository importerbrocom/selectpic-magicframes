---
inclusion: always
---

# Magic Frames — Wedding Selection Studio

A studio admin app + client photo-selection portal. Photographers create a
private album per couple, point it at a Google Drive folder, and the couple
marks each photo as **Bride**, **Groom**, or **Both**. Admin reviews the
selections and downloads them as a ZIP per category.

## Repo layout

```
selectpic-magicframes/
├── backend/     # Laravel 11 (PHP 8.2+) API
└── frontend/    # React 19 + TypeScript + Vite SPA
```

## Current working branch

Active development happens on **`fix/vite7-shared-host-build`**. It contains
the Vite-7 shared-host fix *and* the full studio theme, admin rebuild, Drive
integration, backend sync, and mobile layout — everything described below.
**PR #3** proposes merging it into `main` and is open, not yet merged — see
its description for the full changelog and the "before merging" caveats
below. Keep working on this branch unless told otherwise; if `main` ever
merges #3, re-check this file still matches reality.

## Frontend (`frontend/`)

- React 19 + TypeScript, built with **Vite 7** (`@vitejs/plugin-react@^5`,
  `typescript~5.9`) — deliberately pinned below Vite 8/Rolldown because
  Rolldown panics on this project's shared-hosting PHP/LiteSpeed environment
  (`ulimit`-restricted thread pools). Do not upgrade past Vite 7 without
  confirming it builds on the target host.
- All real app code lives under `frontend/src/studio/` — the theme module.
  `App.tsx` is the top-level screen router (`login` / `admin` / `clientGate`
  / `client`).
- Screens: `LoginView` (admin login), `AdminView` (dashboard, albums list +
  detail, create/edit, staff, profile, settings), `ClientGate` (password
  entry), `ClientView` (the photo-selection gallery).
- **Album cover handling**: `CoverImg.tsx` renders covers and
  `normalizeCoverUrl()` (in `drive.ts`) converts a pasted Google Drive
  *file* share link into a loadable image URL (`lh3.googleusercontent.com/
  d/<id>`); Google Photos album links can't work. An admin-edited cover is
  never overwritten by the Drive auto-cover — the resolver only fills a cover
  when none is set (regression fixed in `4a530df`/`432f922`).
- **Admin per-event downloads**: `AlbumDetail` uses `useAlbumEvents.ts` to
  list each Drive sub-folder (event) and its file ids, then offers
  Bride/Groom/Both/All ZIP buttons **per event** (Engagement, Wedding, …) in
  addition to the all-events row. `ClientView` has a per-event "Download all
  photos" button for the active event folder.
- Styling is one big `App.css` (no CSS modules/Tailwind). The **admin** side
  uses a light "modern" theme (`data-theme="modern"` on `#adminView`, mostly
  Inter font, near-black accents). The **client** side uses a dark
  cinematic "akhila" theme (gold `#c7a15b`/`#d9ad60` accents, Great Vibes /
  Cormorant Garamond / Montserrat fonts, deep-ink backgrounds). Keep new UI
  consistent with whichever side you're touching — see
  `#[[file:frontend/src/App.css]]` for the exact tokens before adding colors.
- **Mobile admin layout** (≤760px): the desktop sidebar is deliberately
  restructured, not just shrunk. `.sidebar` becomes `display: contents` so
  its children lay out independently — the logo block becomes a sticky top
  header (logo left, red **Logout** button pushed right via
  `margin-left: auto`; the `.mobileLogout` button is hidden on desktop), and
  `.nav` becomes a fixed, white, bottom tab bar with each icon's label
  (`.navLabel`) underneath. Several `!important`s in that block exist on
  purpose: earlier base rules for `.sideLogo`/`.sideLogo--image` set
  `display: grid/block` and would otherwise make Logout wrap under the logo.
  The modern-theme selectors (`#adminView[data-theme='modern'] .nav ...`)
  must be overridden explicitly at mobile widths or they win on specificity.
  There are several `@media (max-width: 760px)` blocks in `App.css`; the
  *last* one is the mobile admin chrome and relies on appearing last.
- Fonts are loaded via Google Fonts `<link>` in `frontend/index.html`.
- Logos: `/logo.png` (admin sidebar), `/logotrans.png` (client pages, dark
  backgrounds), `/logo2.png` (favicon). These PNGs live only on the deployed
  server's doc root (not committed to `frontend/public/`) — don't delete them
  when deploying, and if you add new logo assets, put them in
  `frontend/public/` so they ship with the build going forward.

## Backend (`backend/`)

- Laravel 11, PHP 8.2+ (the cPanel host runs PHP 8.4; `composer.lock` is
  pinned to what 8.4 resolves — if the host ever runs 8.3, you must
  `composer update` to regenerate the lock, or switch the host to 8.4).
- `projects` table = albums: `name`, `slug` (unique, auto-generated,
  `name-xxxx` short code), `subtitle`, `password`, `cover`,
  `google_drive_folder_id`, `drive_link`, `locked`, `allow_download`,
  `views`, plus legacy `bride_name`/`groom_name`.
- `image_selections` table = one row **per (project_id, file_id)** — a photo
  has exactly one `choice`: `bride` | `groom` | `both` (plain string column,
  no CHECK constraint — see migration history below). Posting the same
  choice again toggles it off; posting a different choice updates the row in
  place. Unique index is `(project_id, file_id)`.
- Routes (`routes/api.php`): see the full auth-gated list under "Auth &
  album access" below. Download/diagnostic routes:
  `POST photos/zip` and `POST photos/file` (both `auth:sanctum` +
  `ability:admin,album`), and public `GET photos/diagnostics`.
- `GoogleDriveService` lists images via the Drive API (service account or
  API key, see `.env`). `DrivePublicDownloader` downloads **public** Drive
  files server-side (no Google credentials) — see "Photo downloads" below
  for how it streams. ZIP entries get a real image extension detected from
  the file's magic bytes (Drive filenames often have none).
- Migration gotcha (read before touching `choice`): an early migration
  declared `choice` as `enum('bride','groom')`. Laravel's `enum()` on
  **SQLite** adds a `CHECK` constraint, which silently rejected `'both'`
  inserts in production — selections just vanished with no error. Later
  migrations (`2026_02_01_...`, `2026_04_01_...fix_choice_allow_both`)
  rebuild the SQLite table to a plain `varchar` column to remove the CHECK.
  If you add new migrations touching this column, remember SQLite can't
  `ALTER` a CHECK constraint in place — you have to rebuild the table
  (create new, copy data, drop old, rename, recreate indexes).

## Google Drive integration model

Two independent paths, both already built — know which one you're extending:

1. **Browser-side (read)**: `frontend/src/studio/drive.ts` calls the Drive
   API v3 directly from the browser with `VITE_GOOGLE_API_KEY`. Works only
   for folders shared "Anyone with the link". Used to list the album's event
   sub-folders and photos, and to resolve a cover image
   (`useAlbumCover.ts`). Images render via the high-quality
   `lh3.googleusercontent.com` host (from each file's `thumbnailLink`,
   stripped of its size suffix and re-sized with `=w<N>-rj`) rather than the
   deprecated/rate-limited `drive.google.com/uc?export=view`.
2. **Server-side (download)**: `backend` `DrivePublicDownloader` fetches the
   same public files' bytes directly (still no Google credentials) to build
   ZIPs — see "Photo downloads" below. If private (non-public) folders are
   ever required, this is the piece that would need to switch to a Google
   service account + `files->get(..., ['alt' => 'media'])`, which
   `GoogleDriveService` does not currently implement.

## Photo downloads (hard-won — read before touching the ZIP code)

This path caused a long string of 500s on the shared host; the fixes below
are all deployed and verified via a diagnostics endpoint. Don't "simplify"
them back.

- **Single photo** (client gallery ⭳, and `downloadSinglePhoto` in
  `drive.ts`): downloads the image **directly**, not as a 1-file ZIP. It
  tries a browser-side `fetch` of the Drive bytes first, then falls back to
  `POST photos/file` (server streams one file with the right image MIME),
  then to opening the Drive URL. No ZIP involved.
- **Bulk / "download all" / per-category / per-event**: `POST photos/zip`.
  The response is a **`StreamedResponse`** built by `app/Services/
  ZipStreamWriter.php` — a hand-written, STORE-method (no compression) ZIP
  writer that emits a valid archive to `php://output` as each photo is
  fetched. Reasons it is NOT `ZipArchive`:
  - `ZipArchive::close()` buffers every file in memory → exhausted even a
    1 GB limit on a ~247-photo event (the original 500).
  - Building the whole ZIP before sending the first byte tripped the
    LiteSpeed request timeout (a 500 PHP can't catch) on large events.
    Streaming keeps bytes flowing and memory flat.
- **Downloading each file**: `DrivePublicDownloader::downloadToFile()` uses
  **cURL writing straight to a file handle** (`CURLOPT_FILE`), with a header
  callback to detect Google's HTML "can't scan for viruses" interstitial and
  a fallback to `drive.usercontent.google.com/download`. A plain `fopen()`
  HTTP-wrapper reader is the secondary fallback. The older
  `Http::get()`/Guzzle `sink` approach buffered the whole body in memory —
  do not go back to it.
- **Diagnostics**: `GET /apibackend/api/photos/diagnostics` (public, no
  secrets) reports `zip_extension`, `tmp_dir_writable`, `memory_limit`,
  `max_execution_time`, `curl_extension`, `exec_enabled`, `disk_free_bytes`.
  `?file_id=<id>` tests a single real fetch; `?zip_test=ID1,ID2` runs the
  whole fetch+zip end-to-end and reports each step. This is how the host was
  proven healthy (zip ok, 2G memory, 400s exec, 812 GB free) and the cause
  isolated to a timeout, then to the `login`-route 500 (next item). Use it
  first when a download fails rather than guessing.
- **`admin:create`/zip auth 500 fix**: on this API-only app an
  unauthenticated `auth:sanctum` request used to 500 with "Route [login] not
  defined" (the default web redirect). `bootstrap/app.php` now calls
  `$middleware->redirectGuestsTo(fn () => null)` so guests get a clean 401
  JSON — which the frontend handles by re-prompting for the album password.

## Backend/frontend sync (albums + selections)

- `frontend/src/studio/api.ts` is the client for the Laravel API. When
  `VITE_API_BASE_URL` is set, the frontend is **backend-first**: albums load
  from `GET /projects`, create/update/delete call the API, and a client
  marking a photo calls `POST /projects/{id}/selections`. If the API is
  unreachable, it falls back to `localStorage` so the app doesn't hard-fail.
- Admin **does not** get an album's selections for free from `listAlbums()`
  (that endpoint doesn't embed them) — opening an album's detail page in
  `AdminView` explicitly calls `onLoadSelections(id)` to fetch and merge them
  in. If you add a new place that needs selection counts, make sure it
  triggers that load too.
- Client share links are **name-based**: `/a/<slug>` (e.g. `/a/job-maya-7k2x`).
  Opening that path fetches the album by slug from the API, so the link
  works on *any device* — unlike the legacy `#client-<id>` hash links (still
  parsed for backward compatibility by `parseClientLink()` in `App.tsx`),
  which only worked in the browser that originally created the album
  (localStorage-only, no server).
- `App.tsx` resolves the initial screen synchronously from the URL at
  startup (`parseClientLink()`) so a share link opens straight to the
  client gate — it must never flash or fall through to the admin login.

## Deployment (cPanel/LiteSpeed, no Docker)

Both apps are deployed by hand on a single cPanel account — there is no
CI/CD. Know this flow before telling the user to "just deploy":

- **Frontend**: build locally/on the server (`cd frontend && npm run build`)
  then `cp -r dist/* <site-docroot>/`. The site's `.htaccess`
  (`frontend/public/.htaccess`, so it ships with the build) does two things:
  SPA fallback (routes everything to `index.html`) and **no-store on
  `index.html`** with long-cache on hashed `assets/*` — this exists because
  stale cached `index.html` was repeatedly causing "old site / wrong
  behavior" symptoms on mobile after deploys.
- **Backend**: lives in `backend/`, served from `backend/public` via either
  a dedicated subdomain's document root, or — the path actually used in
  production here — a **symlink** from the frontend's doc root, e.g.
  `<frontend-docroot>/apibackend -> backend/public`, so the API is reachable
  same-origin at `<frontend-url>/apibackend/api/...` (avoids CORS and the
  cPanel/DNS subdomain-activation issues hit when trying a separate `api.*`
  subdomain). If a dedicated API subdomain is set up later, don't delete
  that symlink without first repointing `VITE_API_BASE_URL` and confirming
  the new path works end-to-end.
- Standard redeploy sequence after a backend change:
  ```bash
  cd backend && composer install --no-dev --optimize-autoloader \
    && php artisan migrate --force \
    && php artisan config:clear && php artisan route:clear
  ```
  Frontend:
  ```bash
  cd frontend && npm run build && cp -r dist/* <site-docroot>/
  ```
- When diagnosing "my change isn't showing up," check in this order: (1) is
  the server on the right git commit, (2) was it actually rebuilt after
  pulling, (3) was `dist/` actually copied over the docroot, (4) is the
  browser/CDN caching the old `index.html`. This exact sequence of mistakes
  has happened multiple times on this project.
- When diagnosing a backend **500**, the fastest path is: (1) read
  `storage/logs/laravel.log`, and if it's unhelpful, (2) temporarily set
  `APP_DEBUG=true` in `.env` + `php artisan config:clear`, re-run the
  request with `curl` to get the real exception + file:line, then set it
  back to `false`. The `login`-route 500 and the ZIP memory 500 were both
  only pinned down this way. For the download pipeline specifically, use
  `GET photos/diagnostics` (see "Photo downloads").

## Conventions

- No test suite is set up for either side; verify changes by type-checking
  (`tsc`) and, where possible, exercising the real deployed site end-to-end
  — this project's bugs have repeatedly been integration/deploy issues, not
  pure logic bugs, so "it builds" is not sufficient evidence of "it works."
- Keep admin and client theme styles visually distinct (light/Inter vs.
  dark/gold-cinematic) — don't let one side's component accidentally pick up
  the other's palette.
- Commit messages in this repo are detailed and explain *why*, not just
  *what* — follow that pattern given how many deploy/runtime surprises this
  codebase has had.

## Known gaps (unresolved — don't assume these are handled)

Be upfront about these when the user asks "is it ready" or "is it secure."
None are fixed yet; PR #3 lists them as pre-merge caveats.

- **Security (partly hardened — see "Auth & album access" below).**
  Remaining weaknesses: the Staff page "accounts" are client-side
  `localStorage` only (staff cannot log in as themselves); the Drive folder
  is public to anyone with its ID, so a leaked ID bypasses the gate; and
  `POST photos/zip` accepts any public Drive file id from any valid token.
  Album passwords are reversibly encrypted with `APP_KEY` — losing/rotating
  the key makes them unrecoverable, so back it up.
- **Data migration:** albums created before the backend sync exist only in
  one browser's `localStorage`, not on the server, and have no slug. They
  must be re-created in the admin once. Selections made before the `both`
  fix were never persisted and must be re-marked.
- **Unconfirmed on the live site:** the full `both` pipeline (client marks
  Both → server stores it → admin shows count/photos/ZIP). The schema fix
  and a direct SQLite insert were verified, but the end-to-end UI test has
  not been confirmed. Don't claim it's working until the user confirms.
- **No automated tests** on either side. Verification has been `tsc`
  type-checks (using a stubbed `react` types file because `npm install`
  is blocked in the sandbox), PHP `-l` lint, and manual testing on the
  deployed site.
- **Logo PNGs** (`logo.png`, `logotrans.png`, `logo2.png`) exist only on the
  deployed server, not in `frontend/public/`, so a clean checkout won't
  have them.
- **ZIP downloads for big sets** — now streamed (see "Photo downloads"), so
  memory and the earlier timeout/500s are resolved. They can still be *slow*
  for a large event because every original is fetched from Drive before it's
  added to the stream; that's network time, not a bug. A cap of 400 files
  per request is enforced.
- **Old JS bundles accumulate** in the deployed `assets/` folder because
  `cp -r dist/*` never deletes previous hashed files. Harmless but
  messy; clean up by keeping only files referenced by `index.html`.

## Auth & album access (implemented and deployed)

- **Admin**: `POST auth/login` (throttle 5/min) returns a Sanctum token with
  ability `admin` (14 days), stored in `localStorage` `mf.admin.token`.
  `auth/me`, `auth/logout`, `projects` CRUD and `drive/images` need
  `auth:sanctum` + `abilities:admin`. Create/reset the admin with
  `php artisan admin:create` (prompts; nothing hardcoded). In local no-API
  mode the demo credentials still work.
- **Album passwords**: `Project.password` uses the `encrypted` cast, is in
  `$hidden`, and is only exposed (via `makeVisible`) on admin endpoints. The
  migration `2026_05_01_000000_encrypt_project_passwords` encrypts existing
  plaintext rows idempotently.
- **Client unlock**: public `GET projects/by-slug/{slug}` returns only
  id/slug/name/subtitle/cover/locked/allow_download. `POST
  projects/by-slug/{slug}/unlock` (throttle 10/min) checks the password
  server-side and returns the full album (incl. Drive folder + selections)
  plus a 12h token with abilities `album` and `album:{id}`, kept in
  `sessionStorage`.
- **Selections / submit** need admin or the matching album token
  (`project.access` middleware = `EnsureProjectAccess`). `POST
  projects/{id}/submit` locks the album; after that clients get HTTP 423 on
  selection changes, admins can still edit. `POST photos/zip` and
  `POST photos/file` accept `ability:admin,album`.
- **Guests get 401, not 500**: `bootstrap/app.php` calls
  `redirectGuestsTo(fn () => null)` — without it, an unauthenticated request
  to any `auth:sanctum` route 500s with "Route [login] not defined" on this
  API-only app. The Sanctum middleware aliases (`CheckAbilities`,
  `CheckForAnyAbility`) are confirmed working on the live server.
- **Deploy order matters**: backend (`migrate`, `admin:create`) must be live
  before/with the new frontend, otherwise the admin is locked out. Roll back
  with `php artisan migrate:rollback --step=1` (decrypts passwords) plus the
  previous commit.
- **Still waiting on the user**: confirmation of the end-to-end `both`
  pipeline test (see Known gaps above).

## Working with this user

- They deploy and test on a real phone and desktop, and report with
  screenshots. When a reported change "didn't update," it has usually been
  a stale deploy or cache, not a code bug — verify the deployed commit and
  bundle before changing code again.
- Visual requests are precise ("exactly like the second screenshot"). Read
  the screenshots carefully for the specific differences (spacing, label
  vs. icon-only, alignment) rather than guessing the intent.
- The sandbox has no npm registry access, so builds can't be run here —
  say so plainly and give the user the exact commands to build on the
  server instead of implying it was verified.
