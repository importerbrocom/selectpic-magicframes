import { useEffect, useState } from 'react';
import { bestImageUrl, getApiKey, listImages, listSubFolders } from './drive';
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
  const [cover, setCover] = useState(album.cover || '');

  useEffect(() => {
    // A stored cover wins immediately.
    if (album.cover) {
      setCover(album.cover);
      return;
    }
    const key = getApiKey();
    if (!album.driveFolderId || !key) {
      setCover('');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Try the parent folder first, then its first sub-folder.
        let imgs = await listImages(album.driveFolderId, key);
        if (!imgs.length) {
          const subs = await listSubFolders(album.driveFolderId, key);
          if (subs.length) imgs = await listImages(subs[0].id, key);
        }
        if (!cancelled && imgs.length) setCover(bestImageUrl(imgs[0], 2560));
      } catch {
        // Ignore — caller falls back to the stock image.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [album.cover, album.driveFolderId]);

  return cover;
}
