interface BrandMarkProps {
  /** Render the two-line "Magic Frames" version (with trademark). */
  full?: boolean;
}

/** The "Magic Frames" script wordmark used across the studio screens. */
export function BrandMark({ full = true }: BrandMarkProps) {
  return (
    <div className="brandMark">
      Magic
      <br />
      Frames
      {full && <small>™</small>}
    </div>
  );
}
