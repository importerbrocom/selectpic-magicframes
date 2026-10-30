// Browser-side Google Drive API v3 client.
//
// Uses a public Drive API key (set at build time via VITE_GOOGLE_API_KEY) to
// read PUBLIC folders — the key can only see folders/files shared as
// "Anyone with the link". No backend required.

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DrivePhoto {
  id: string;
  name: string;
  /** Large image URL for the zoom / cover view. */
  url: string;
  /** Grid thumbnail URL. */
  thumbnail: string;
  /**
   * Google's own hosted thumbnail base (lh3.googleusercontent.com, no size
   * suffix) when available — higher quality than the generic thumbnail
   * endpoint. Use `sizedLink()` to request a specific width.
   */
  hostedBase: string | null;
}

const API_BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function getApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ?? '';
}

/**
 * Extract a Drive folder ID from either a raw ID or a full share URL such as
 * https://drive.google.com/drive/folders/<ID>?usp=sharing
 */
export function parseFolderId(input: string): string {
  const value = (input || '').trim();
  if (!value) return '';
  // /folders/<id>
  const folders = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folders) return folders[1];
  // ?id=<id> or &id=<id>
  const idParam = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  // /d/<id>
  const d = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (d) return d[1];
  // Already looks like a bare ID.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return value;
  return '';
}

/**
 * A sized thumbnail URL that renders reliably for public Drive files.
 * (The old `uc?export=view` endpoint is rate-limited/deprecated and often
 * fails, so we use the thumbnail endpoint at the requested width for every
 * size — grid, cover and full-screen zoom.)
 */
export function thumbUrl(id: string, size = 1000): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/**
 * Google's Drive `thumbnailLink` looks like
 *   https://lh3.googleusercontent.com/drive-storage/<...>=s220
 * Strip the trailing `=s<N>` / `=w<N>-h<N>` size suffix so we can request a
 * larger, sharper render. Returns the base without a size suffix.
 */
function hostedBaseFromLink(link?: string): string | null {
  if (!link || !link.includes('googleusercontent.com')) return null;
  return link.replace(/=[swh].*$/i, '');
}

/**
 * Request a specific width from a hosted googleusercontent base.
 * `-rj` = high-quality JPEG, no upscaling — sharper than the default render.
 */
export function sizedLink(base: string, width: number): string {
  return `${base}=w${width}-rj`;
}

/**
 * Best available image URL at the given width: prefers the high-quality
 * googleusercontent host, falling back to the generic thumbnail endpoint.
 */
export function bestImageUrl(photo: DrivePhoto, width: number): string {
  return photo.hostedBase
    ? sizedLink(photo.hostedBase, width)
    : thumbUrl(photo.id, width);
}

async function listFiles(query: string, key: string): Promise<DriveFileRaw[]> {
  const files: DriveFileRaw[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key,
      q: query,
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) {
      let message = `Drive request failed (${res.status})`;
      try {
        const body = await res.json();
        message = body?.error?.message ?? message;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }
    const body = (await res.json()) as DriveListResponse;
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return files;
}

interface DriveFileRaw {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
}
interface DriveListResponse {
  files?: DriveFileRaw[];
  nextPageToken?: string;
}

/** List immediate sub-folders of a folder (the "events"). */
export async function listSubFolders(
  folderId: string,
  key: string,
): Promise<DriveFolder[]> {
  const q = `'${folderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const files = await listFiles(q, key);
  return files
    .map((f) => ({ id: f.id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Direct-download URL for a public Drive file (original bytes). */
export function downloadUrl(id: string): string {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

const BACKEND_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? '';

export interface ZipFile {
  file_id: string;
  file_name?: string;
}

/**
 * Ask the backend to build a single ZIP of the given Drive photos and save it.
 * Requires VITE_API_BASE_URL to point at the Laravel API. Throws with a clear
 * message if the backend isn't configured or the request fails.
 */
export async function downloadSelectedZip(
  album: string,
  type: string,
  files: ZipFile[],
): Promise<void> {
  if (!BACKEND_BASE) {
    throw new Error(
      'Downloads need the backend API (set VITE_API_BASE_URL in the build).',
    );
  }

  const res = await fetch(`${BACKEND_BASE}/api/photos/zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify({ album, type, files }),
  });

  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  a.download = `${slug(album) || 'album'}_${slug(type) || 'selected'}_photos.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** List image files inside a folder. */
export async function listImages(
  folderId: string,
  key: string,
): Promise<DrivePhoto[]> {
  const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const files = await listFiles(q, key);
  return files.map((f) => {
    const hostedBase = hostedBaseFromLink(f.thumbnailLink);
    return {
      id: f.id,
      name: f.name,
      // Prefer the high-quality googleusercontent host for both the large
      // render and the grid thumbnail; fall back to the generic endpoint.
      url: hostedBase ? sizedLink(hostedBase, 1600) : thumbUrl(f.id, 1600),
      thumbnail: hostedBase ? sizedLink(hostedBase, 700) : thumbUrl(f.id, 700),
      hostedBase,
    };
  });
}
