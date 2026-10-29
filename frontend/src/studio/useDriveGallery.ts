import { useEffect, useMemo, useState } from 'react';
import {
  getApiKey,
  listImages,
  listSubFolders,
  type DrivePhoto,
} from './drive';
import { photos as demoPhotos } from './data';
import type { Album } from './types';

export interface GalleryFolder {
  /** Stable key used for tab selection + image cache. */
  id: string;
  name: string;
}

export interface GalleryState {
  folders: GalleryFolder[];
  activeFolderId: string;
  setActiveFolderId: (id: string) => void;
  photos: DrivePhoto[];
  loadingFolders: boolean;
  loadingPhotos: boolean;
  error: string | null;
  /** True when this album is served from the bundled demo data. */
  isDemo: boolean;
}

/** Build the demo gallery (grouped by the seed album's event names). */
function demoFolders(album: Album): GalleryFolder[] {
  const names = album.events?.length
    ? album.events
    : [...new Set(demoPhotos.map((p) => p.folder))];
  return names.map((n) => ({ id: n, name: n }));
}

function demoPhotosFor(folderId: string): DrivePhoto[] {
  return demoPhotos
    .filter((p) => p.folder === folderId)
    .map((p) => ({ id: p.id, name: p.name, url: p.url, thumbnail: p.url }));
}

/**
 * Resolve an album's gallery. For Drive-backed albums it lists the parent
 * folder's sub-folders (event tabs) and loads each sub-folder's images on
 * demand. For seed/demo albums it falls back to the bundled photos.
 */
export function useDriveGallery(album: Album): GalleryState {
  const isDemo = !album.driveFolderId;
  const apiKey = getApiKey();

  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState('');
  const [cache, setCache] = useState<Record<string, DrivePhoto[]>>({});
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo albums: static folders, no network.
  const demoFolderList = useMemo(
    () => (isDemo ? demoFolders(album) : []),
    [isDemo, album],
  );

  // Resolve folders (Drive sub-folders, or the parent as a single folder).
  useEffect(() => {
    let cancelled = false;

    if (isDemo) {
      setFolders(demoFolderList);
      setActiveFolderId(demoFolderList[0]?.id ?? '');
      setError(null);
      return;
    }

    if (!apiKey) {
      setError(
        'Google Drive is not configured (missing VITE_GOOGLE_API_KEY build setting).',
      );
      setFolders([]);
      return;
    }

    setLoadingFolders(true);
    setError(null);
    setCache({});

    listSubFolders(album.driveFolderId, apiKey)
      .then((subs) => {
        if (cancelled) return;
        // No sub-folders → treat the parent folder itself as one gallery.
        const resolved: GalleryFolder[] = subs.length
          ? subs
          : [{ id: album.driveFolderId, name: 'All Photos' }];
        setFolders(resolved);
        setActiveFolderId(resolved[0]?.id ?? '');
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setFolders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFolders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemo, apiKey, album.driveFolderId, demoFolderList]);

  // Load the active folder's images (cached per folder id).
  useEffect(() => {
    if (!activeFolderId) return;

    if (isDemo) {
      if (!cache[activeFolderId]) {
        setCache((c) => ({ ...c, [activeFolderId]: demoPhotosFor(activeFolderId) }));
      }
      return;
    }

    if (!apiKey || cache[activeFolderId]) return;

    let cancelled = false;
    setLoadingPhotos(true);
    setError(null);

    listImages(activeFolderId, apiKey)
      .then((imgs) => {
        if (!cancelled) setCache((c) => ({ ...c, [activeFolderId]: imgs }));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingPhotos(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFolderId, isDemo, apiKey, cache]);

  return {
    folders,
    activeFolderId,
    setActiveFolderId,
    photos: cache[activeFolderId] ?? [],
    loadingFolders,
    loadingPhotos,
    error,
    isDemo,
  };
}
