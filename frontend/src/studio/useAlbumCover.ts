import { useEffect, useState } from 'react';
import {
  bestImageUrl,
  getApiKey,
  listImages,
  listSubFolders,
  normalizeCoverUrl,
} from './drive';
import type { Album } from './types';

/**
 * Resolve a single cover image URL for an album, used as the background on the
 * client gate and hero. Order of preference:
 *   1. the album's stored cover,
 *   2. the first image found in the album's Drive folder (or its first
 *      sub-folder),
 *   3. '' (callers fall back to the themed stock image).
 */
export function useAlbumCover(album: Album): string {
  const stored = normalizeCoverUrl(album.cover);
  const [cover, setCover] = useState(stored);

  useEffect(() => {
    let cancelled = false;
    const key = getApiKey();

    async function fromDrive() {
      if (!album.driveFolderId || !key) {
        if (!cancelled) setCover('');
        return;
      }
      try {
        // Try the parent folder first, then its first sub-folder.
        let imgs = await listImages(album.driveFolderId, key);
        if (!imgs.length) {
          const subs = await listSubFolders(album.driveFolderId, key);
          if (subs.length) imgs = await listImages(subs[0].id, key);
        }
        if (!cancelled && imgs.length) setCover(bestImageUrl(imgs[0], 3200));
      } catch {
        // Ignore — caller falls back to the stock image.
      }
    }

    if (stored) {
      // Use the stored cover only if it actually loads; otherwise fall back
      // to the first Drive photo instead of a blank background.
      setCover(stored);
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.onerror = () => void fromDrive();
      probe.src = stored;
    } else {
      void fromDrive();
    }

    return () => {
      cancelled = true;
    };
  }, [stored, album.driveFolderId]);

  return cover;
}
