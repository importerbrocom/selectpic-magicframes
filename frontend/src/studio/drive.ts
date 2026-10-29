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
  /** Best-effort viewable image URL. */
  url: string;
  thumbnail: string | null;
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

/** A direct-view URL that works for publicly shared Drive images. */
function viewUrl(id: string): string {
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

/** A sized thumbnail URL that renders reliably for public files. */
export function thumbUrl(id: string, size = 1000): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
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

/** List image files inside a folder. */
export async function listImages(
  folderId: string,
  key: string,
): Promise<DrivePhoto[]> {
  const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const files = await listFiles(q, key);
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    url: viewUrl(f.id),
    thumbnail: f.thumbnailLink ?? thumbUrl(f.id),
  }));
}
