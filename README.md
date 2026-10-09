# SelectPic MagicFrames

A full-stack photo-selection tool for weddings. Photographers point a project at a
Google Drive folder, and the bride and groom each pick their favourite frames from a
gallery. The two sets of choices are tracked **separately per project**.

- **Backend:** Laravel 11 (PHP 8.2+) REST API with Google Drive integration.
- **Frontend:** React 19 + TypeScript + Vite single-page app.

```
selectpic-magicframes/
├── backend/     # Laravel 11 API
└── frontend/    # React 19 + Vite SPA
```

## Features

- Create projects, each optionally linked to a Google Drive folder and bride/groom names.
- Fetch all images from a Drive folder via the backend (service account or API key).
- Gallery with per-image, **color-coded** `Bride` (rose) and `Groom` (blue) buttons.
- Selecting an image sends the file ID + choice to the API; clicking again toggles it off.
- Side-by-side summary panels keep the bride's and groom's picks clearly separated.

## Data model

| Table              | Columns |
|--------------------|---------|
| `projects`         | `id`, `name`, `google_drive_folder_id`, `bride_name`, `groom_name`, timestamps |
| `image_selections` | `id`, `project_id` (FK → projects), `file_id`, `file_name`, `thumbnail_link`, `choice` (`bride`\|`groom`), timestamps |

A `project` has many `image_selections`; selections are unique per
`(project_id, file_id, choice)` so each side can independently pick the same image.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/projects` | List projects (with per-side selection counts) |
| POST   | `/api/projects` | Create a project |
| GET    | `/api/projects/{project}` | Show a project with its selections |
| PUT    | `/api/projects/{project}` | Update a project |
| DELETE | `/api/projects/{project}` | Delete a project |
| GET    | `/api/drive/images?folder_id=…` | Fetch images from a Drive folder (or `project_id=…` to use the project's stored folder) |
| GET    | `/api/projects/{project}/selections` | List selections grouped into `bride` / `groom` |
| POST   | `/api/projects/{project}/selections` | Save/toggle a selection (`file_id`, `choice`, optional `file_name`, `thumbnail_link`) |
| DELETE | `/api/projects/{project}/selections/{selection}` | Delete a selection |

## Running locally

### Backend

```bash
cd backend
composer install
cp .env.example .env        # already present after create-project
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve            # http://localhost:8000
```

Configure Google Drive access in `backend/.env` (one of the two):

```dotenv
# Preferred — service account with read access to the folders:
GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/to/service-account.json
# Or, for publicly shared folders:
GOOGLE_DRIVE_API_KEY=your-api-key
```

`FRONTEND_URL` controls CORS (comma-separated origins, defaults to `http://localhost:5173`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env         # sets VITE_API_BASE_URL=http://localhost:8000
npm run dev                  # http://localhost:5173
```

## Production (single domain)

For deployment the React app is built directly into Laravel's `public/` and
served from the same origin, with the API under `/api` (no CORS needed):

```bash
cd frontend && npm run build     # outputs into ../backend/public (uses .env.production)
```

Laravel serves `public/index.html` for all non-`/api` routes (SPA fallback in
`routes/web.php`). Or run the packaging helper, which builds the SPA and
produces an upload-ready zip:

```bash
./deploy.sh                 # Layout A (point doc root at public/)
./deploy.sh --layout b      # Layout B (fixed doc root)
```

Full cPanel instructions — build locally, upload, then run the server setup —
are in [`DEPLOYMENT.md`](./DEPLOYMENT.md). On the server you can run
[`server-setup.sh`](./server-setup.sh) (from `backend/`) to install deps,
prepare `.env`, migrate, and cache in one go. The production env template is
[`backend/.env.production.example`](./backend/.env.production.example).

## Notes

- The Drive endpoint returns `502` with a clear message when credentials are missing,
  and `422` when no folder ID can be resolved.
- Image URLs fall back to a direct `drive.google.com/uc?...` view link so publicly
  shared files render even without a thumbnail.
