interface BrandMarkProps {
  /** Render the two-line "Magic Frames" version (with trademark). */
  full?: boolean;
  /** Optional logo image URL. When set, shows the image instead of text. */
  src?: string;
  /** Alt text / accessible label for the image logo. */
  alt?: string;
  /** Extra class for the image (sizing per context). */
  imgClassName?: string;
}

/**
 * The "Magic Frames" brand. Renders an image logo when `src` is given,
 * otherwise falls back to the CSS script wordmark.
 */
export function BrandMark({
  full = true,
  src,
  alt = 'Magic Frames',
  imgClassName,
}: BrandMarkProps) {
  if (src) {
    return (
      <img
        className={'brandLogo ' + (imgClassName ?? '')}
        src={src}
        alt={alt}
      />
    );
  }
  return (
    <div className="brandMark">
      Magic
      <br />
      Frames
      {full && <small>™</small>}
    </div>
  );
}
