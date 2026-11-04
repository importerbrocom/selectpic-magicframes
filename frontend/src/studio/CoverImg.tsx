import { useEffect, useState } from 'react';
import { normalizeCoverUrl } from './drive';

interface CoverImgProps {
  src: string;
  className?: string;
  placeholderClassName: string;
  /** Text shown inside the placeholder when there is no cover. */
  emptyText?: string;
}

/**
 * Album cover <img> that normalizes Drive share links and, if the link can't
 * be displayed, shows a placeholder explaining why instead of a broken icon.
 */
export function CoverImg({
  src,
  className,
  placeholderClassName,
  emptyText,
}: CoverImgProps) {
  const url = normalizeCoverUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <div className={placeholderClassName} title={failed ? url : undefined}>
        {failed
          ? 'Cover link can’t be displayed — use a direct image link or a Drive file shared as “Anyone with the link”.'
          : emptyText}
      </div>
    );
  }
  return (
    <img
      className={className}
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
