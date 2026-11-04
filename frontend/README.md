# Magic Frames — Wedding Selection Studio (frontend)

React 19 + TypeScript + Vite single-page app implementing the **Magic Frames
Wedding Selection Studio** theme. It is a fully client-side demo of the studio
experience, with four screens wired together in `src/App.tsx`:

| Screen | Component | Purpose |
|--------|-----------|---------|
| Admin sign-in | `studio/LoginView.tsx` | Studio admin login (demo: `admin@magicframes.test` / `password`). |
| Admin dashboard | `studio/AdminView.tsx` | Stats, recent albums, album table, create-album form, staff/profile/settings tabs, per-album Manage modal and CSV export. |
| Client gate | `studio/ClientGate.tsx` | Password landing page for a private client album. |
| Client portal | `studio/ClientView.tsx` | Per-folder gallery where the couple marks each photo for **Bride**, **Groom** or **Both**, with zoom, filters, and a submit-and-lock flow. |

### Layout

```
src/
├── App.tsx            # Screen router + app state (albums, selections, toast)
├── App.css            # Full Magic Frames theme stylesheet
└── studio/
    ├── types.ts       # Album, Photo, Selections, Screen, …
    ├── data.ts        # Seed albums + demo photos
    ├── helpers.ts     # selectionCounts(), downloadAlbumCSV()
    ├── useToast.ts     # Transient toast hook
    ├── BrandMark.tsx  # Script wordmark
    ├── LoginView.tsx
    ├── AdminView.tsx
    ├── ClientGate.tsx
    └── ClientView.tsx
```

### Deep links

Opening `#client-<albumId>` (e.g. the link copied from the admin **Manage**
modal) jumps straight to that album's password gate.

### Google Drive photos (no backend)

Albums can pull their photos straight from a **public Google Drive folder**,
read in the browser with a Drive API key — no Laravel backend required.

- When creating an album, paste the **parent Drive folder link** into
  *PHOTO GALLERY → Google Drive Folder Link*.
- Each **sub-folder** of that parent becomes an **event tab** (Haldi,
  Engagement, Wedding…). If there are no sub-folders, all images in the parent
  show under a single "All Photos" tab.
- The folder **and its photos must be shared as "Anyone with the link"** — an
  API key can only read public files.

Set the key at build time in `frontend/.env`:

```dotenv
VITE_GOOGLE_API_KEY=your-drive-api-key
```

Requirements for the key (Google Cloud Console):
- The **Google Drive API** must be enabled for the key's project.
- If the key has an **HTTP-referrer restriction**, add your site's domain
  (e.g. `selectpic-magicframes.nokkoo.in/*`) to the allowed referrers.

Albums created **without** a Drive link fall back to the bundled demo photos,
so the UI still works out of the box.

### Fonts

The theme loads **DM Sans**, **Playfair Display**, and **Great Vibes** from
Google Fonts via `index.html`.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint     # oxlint
```

> Note: the demo data and selection state live entirely in the browser; this
> theme does not yet call the Laravel API.
