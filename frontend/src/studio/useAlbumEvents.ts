import { useEffect, useState } from 'react';
import { getApiKey, listImages, listSubFolders } from './drive';
import type { Album } from './types';

export interface AlbumEvent {
  /** Drive folder id for this event. */
  id: string;
  /** Event (sub-folder) name, e.g. "Engagement", "Wedding". */
  name: string;
  /** Set of Drive file ids that live in this event, for fast lookup. */
  fileIds: Set<string>;
}

export interface AlbumEventsState {
  events: AlbumEvent[];
  loading: boolean;
  error: string | null;
}

/**
 * List every event (sub-folder) of a Drive album together with the set of
 * image file ids in each, so the admin can group selected photos by event
 * (Engagement / Wedding / …) for per-event downloads.
 *
 * Non-Drive (demo) albums resolve to an empty list.
 */
export function useAlbumEvents(album: Album): AlbumEventsState {
  const [events, setEvents] = useState<AlbumEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderId = album.driveFolderId;

  useEffect(() => {
    if (!folderId) {
      setEvents([]);
      setError(null);
      return;
    }
    const key = getApiKey();
    if (!key) {
      setError('Google Drive is not configured.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Event sub-folders, or the parent itself when there are none.
        let folders = await listSubFolders(folderId, key);
        if (!folders.length) {
          folders = [{ id: folderId, name: 'All Photos' }];
        }

        const resolved: AlbumEvent[] = [];
        for (const f of folders) {
          const imgs = await listImages(f.id, key);
          resolved.push({
            id: f.id,
            name: f.name,
            fileIds: new Set(imgs.map((i) => i.id)),
          });
        }

        if (!cancelled) setEvents(resolved);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [folderId]);

  return { events, loading, error };
}
