import type { Choice, DriveImage } from '../types';

interface ImageCardProps {
  image: DriveImage;
  /** Which sides have currently selected this image. */
  selected: { bride: boolean; groom: boolean };
  onToggle: (image: DriveImage, choice: Choice) => void;
  disabled?: boolean;
}

/**
 * A single gallery tile: the image plus color-coded bride/groom buttons.
 */
export function ImageCard({ image, selected, onToggle, disabled }: ImageCardProps) {
  const src = image.thumbnail_link ?? image.image_url;

  return (
    <figure className="image-card">
      <div className="image-card__media">
        <img src={src} alt={image.name} loading="lazy" referrerPolicy="no-referrer" />
        {(selected.bride || selected.groom) && (
          <div className="image-card__badges">
            {selected.bride && <span className="badge badge--bride">Bride</span>}
            {selected.groom && <span className="badge badge--groom">Groom</span>}
          </div>
        )}
      </div>

      <figcaption className="image-card__name" title={image.name}>
        {image.name}
      </figcaption>

      <div className="image-card__actions">
        <button
          type="button"
          disabled={disabled}
          className={`btn btn--bride ${selected.bride ? 'is-active' : ''}`}
          onClick={() => onToggle(image, 'bride')}
          aria-pressed={selected.bride}
        >
          {selected.bride ? '✓ Bride' : 'Bride'}
        </button>
        <button
          type="button"
          disabled={disabled}
          className={`btn btn--groom ${selected.groom ? 'is-active' : ''}`}
          onClick={() => onToggle(image, 'groom')}
          aria-pressed={selected.groom}
        >
          {selected.groom ? '✓ Groom' : 'Groom'}
        </button>
      </div>
    </figure>
  );
}
