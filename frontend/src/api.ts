// Thin typed client around the Laravel API.

import type {
  Choice,
  DriveImage,
  GroupedSelections,
  ImageSelection,
  Project,
} from './types';

// When VITE_API_BASE_URL is set (e.g. local dev against a separate Laravel
// server, or a split-domain deployment) requests go to `${base}/api`.
// When it is empty/unset (the single-domain production build served from
// Laravel's public/), requests go to the same origin at `/api`.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // Ignore JSON parse errors and keep the default message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Projects ----------------------------------------------------------------
  listProjects(): Promise<{ data: Project[] }> {
    return request('/projects');
  },

  createProject(payload: {
    name: string;
    google_drive_folder_id?: string;
    bride_name?: string;
    groom_name?: string;
  }): Promise<{ data: Project }> {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getProject(id: number): Promise<{ data: Project }> {
    return request(`/projects/${id}`);
  },

  // Google Drive ------------------------------------------------------------
  fetchDriveImages(params: {
    folder_id?: string;
    project_id?: number;
  }): Promise<{ data: DriveImage[]; meta: { folder_id: string; count: number } }> {
    const query = new URLSearchParams();
    if (params.folder_id) query.set('folder_id', params.folder_id);
    if (params.project_id) query.set('project_id', String(params.project_id));
    return request(`/drive/images?${query.toString()}`);
  },

  // Selections --------------------------------------------------------------
  getSelections(projectId: number): Promise<{
    data: GroupedSelections;
    meta: { project_id: number; bride_count: number; groom_count: number };
  }> {
    return request(`/projects/${projectId}/selections`);
  },

  saveSelection(
    projectId: number,
    payload: {
      file_id: string;
      file_name?: string;
      thumbnail_link?: string | null;
      choice: Choice;
    },
  ): Promise<{ data: ImageSelection | null; meta: { action: 'added' | 'removed' } }> {
    return request(`/projects/${projectId}/selections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
