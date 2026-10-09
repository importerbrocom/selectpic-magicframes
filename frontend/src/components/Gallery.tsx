import type { Choice, DriveImage, GroupedSelections } from '../types';
import { ImageCard } from './ImageCard';

interface GalleryProps {
  images: DriveImage[];
  selections: GroupedSelections;
  onToggle: (image: DriveImage, choice: Choice) => void;
  loading: boolean;
  busyFileId: string | null;
}

/**
 * Responsive grid of images with per-image bride/groom controls.
 */
export function Gallery({ images, selections, onToggle, loading, busyFileId }: GalleryProps) {
  if (loading) {
    return <p className="gallery__hint">Loading images from Google Drive…</p>;
  }

  if (!images.length) {
    return (
      <p className="gallery__hint">
        No images loaded yet. Enter a Google Drive folder ID and click “Fetch images”.
      </p>
    );
  }

  const brideIds = new Set(selections.bride.map((s) => s.file_id));
  const groomIds = new Set(selections.groom.map((s) => s.file_id));

  return (
    <div className="gallery">
      {images.map((image) => (
        <ImageCard
          key={image.file_id}
          image={image}
          selected={{
            bride: brideIds.has(image.file_id),
            groom: groomIds.has(image.file_id),
          }}
          onToggle={onToggle}
          disabled={busyFileId === image.file_id}
        />
      ))}
    </div>
  );
}
