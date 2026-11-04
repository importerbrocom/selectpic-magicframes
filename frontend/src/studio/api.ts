// Thin client for the Laravel backend: albums (projects) + selections.
// Lets share links work on any device by storing albums server-side.

import type { Album, SelectionType } from './types';

const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? '';

export function apiConfigured(): boolean {
  return Boolean(BASE);
}

// --- Token storage ---------------------------------------------------------
// Admin token persists across visits; album tokens live only for the tab.
const ADMIN_KEY = 'mf.admin.token';
const albumKey = (id: number) => `mf.album.token.${id}`;

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store: Storage, key: string, value: string | null) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function adminToken(): string | null {
  return safeGet(localStorage, ADMIN_KEY);
}

function albumToken(id: number): string | null {
  return safeGet(sessionStorage, albumKey(id));
}

/** Authorization header for an album (album token first, else admin token). */
export function authHeader(albumId?: number): Record<string, string> {
  const t = (albumId !== undefined && albumToken(albumId)) || adminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(
  path: string,
  init?: RequestInit,
  albumId?: number,
  auth = true,
): Promise<T> {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(auth ? authHeader(albumId) : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && 'Authorization' in headers) {
      if (albumId === undefined) safeSet(localStorage, ADMIN_KEY, null);
      window.dispatchEvent(new Event('mf:unauthorized'));
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Shape the backend returns for a project. */
interface ApiProject {
  id: number;
  slug: string | null;
  name: string;
  subtitle: string | null;
  password?: string | null;
  cover: string | null;
  google_drive_folder_id?: string | null;
  drive_link?: string | null;
  locked: boolean;
  allow_download: boolean;
  views?: number;
}

/** Map a backend project to the frontend Album shape. */
export function toAlbum(p: ApiProject): Album {
  return {
    id: p.id,
    slug: p.slug ?? undefined,
    name: p.name,
    subtitle: p.subtitle ?? '',
    password: p.password ?? '',
    cover: p.cover ?? '',
    driveFolderId: p.google_drive_folder_id ?? '',
    driveLink: p.drive_link ?? '',
    locked: Boolean(p.locked),
    allowDownload: p.allow_download !== false,
    views: p.views ?? 0,
    photos: 0,
    status: p.locked ? 'Selections submitted' : 'In progress',
    selections: {},
  };
}

/** Payload sent to the backend when creating/updating an album. */
function toPayload(a: Partial<Album>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.name !== undefined) out.name = a.name;
  if (a.subtitle !== undefined) out.subtitle = a.subtitle;
  if (a.password !== undefined) out.password = a.password;
  if (a.cover !== undefined) out.cover = a.cover;
  if (a.driveFolderId !== undefined) out.google_drive_folder_id = a.driveFolderId;
  if (a.driveLink !== undefined) out.drive_link = a.driveLink;
  if (a.locked !== undefined) out.locked = a.locked;
  if (a.allowDownload !== undefined) out.allow_download = a.allowDownload;
  return out;
}

function mapSelections(data: {
  bride?: { file_id: string }[];
  groom?: { file_id: string }[];
  both?: { file_id: string }[];
}): Record<string, SelectionType> {
  const map: Record<string, SelectionType> = {};
  data.bride?.forEach((s) => (map[s.file_id] = 'bride'));
  data.groom?.forEach((s) => (map[s.file_id] = 'groom'));
  data.both?.forEach((s) => (map[s.file_id] = 'both'));
  return map;
}

export const api = {
  // Auth -------------------------------------------------------------------
  hasAdminToken(): boolean {
    return adminToken() !== null;
  },

  async login(email: string, password: string): Promise<void> {
    const { token } = await req<{ token: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      undefined,
      false,
    );
    safeSet(localStorage, ADMIN_KEY, token);
  },

  async me(): Promise<void> {
    await req<unknown>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await req<void>('/auth/logout', { method: 'POST' });
    } catch {
      /* token may already be invalid */
    }
    safeSet(localStorage, ADMIN_KEY, null);
  },

  clearAlbumTokens(): void {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('mf.album.token.'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },

  /** Verify the album password server-side; returns the full album. */
  async unlockAlbum(slug: string, password: string): Promise<Album> {
    const res = await req<{
      token: string;
      data: ApiProject & {
        bride_selections?: { file_id: string }[];
        groom_selections?: { file_id: string }[];
        both_selections?: { file_id: string }[];
      };
    }>(
      `/projects/by-slug/${encodeURIComponent(slug)}/unlock`,
      { method: 'POST', body: JSON.stringify({ password }) },
      undefined,
      false,
    );
    safeSet(sessionStorage, albumKey(res.data.id), res.token);
    const album = toAlbum(res.data);
    album.password = password;
    album.selections = mapSelections({
      bride: res.data.bride_selections,
      groom: res.data.groom_selections,
      both: res.data.both_selections,
    });
    return album;
  },

  async submitAlbum(id: number): Promise<void> {
    await req<unknown>(`/projects/${id}/submit`, { method: 'POST' }, id);
  },

  async listAlbums(): Promise<Album[]> {
    const { data } = await req<{ data: ApiProject[] }>('/projects');
    return data.map(toAlbum);
  },

  async createAlbum(a: Omit<Album, 'id'>): Promise<Album> {
    const { data } = await req<{ data: ApiProject }>('/projects', {
      method: 'POST',
      body: JSON.stringify(toPayload(a)),
    });
    return toAlbum(data);
  },

  async updateAlbum(id: number, patch: Partial<Album>): Promise<Album> {
    const { data } = await req<{ data: ApiProject }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(patch)),
    });
    return toAlbum(data);
  },

  async deleteAlbum(id: number): Promise<void> {
    await req<void>(`/projects/${id}`, { method: 'DELETE' });
  },

  /** Public fetch by slug (client link on any device). */
  async getAlbumBySlug(slug: string): Promise<Album> {
    const { data } = await req<{ data: ApiProject }>(
      `/projects/by-slug/${encodeURIComponent(slug)}`,
    );
    return toAlbum(data);
  },

  // Selections -------------------------------------------------------------
  async getSelections(projectId: number): Promise<Record<string, SelectionType>> {
    const { data } = await req<{
      data: {
        bride: { file_id: string }[];
        groom: { file_id: string }[];
        both: { file_id: string }[];
      };
    }>(`/projects/${projectId}/selections`, undefined, projectId);
    return mapSelections(data);
  },

  /** Toggle/replace a selection for a photo. */
  async saveSelection(
    projectId: number,
    fileId: string,
    choice: SelectionType,
    fileName?: string,
  ): Promise<void> {
    await req<unknown>(
      `/projects/${projectId}/selections`,
      {
        method: 'POST',
        body: JSON.stringify({
          file_id: fileId,
          file_name: fileName,
          choice,
        }),
      },
      projectId,
    );
  },
};
