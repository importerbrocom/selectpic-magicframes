import { useMemo, useState } from 'react';
import { BrandMark } from './BrandMark';
import { SocialIcons } from './SocialIcons';
import { selectionCounts } from './helpers';
import { useDriveGallery } from './useDriveGallery';
import type { DrivePhoto } from './drive';
import type { Album, PhotoFilter, SelectionType } from './types';

interface ClientViewProps {
  album: Album;
  onMark: (photoId: string, type: SelectionType) => void;
  onSubmit: () => void;
  onExit: () => void;
  showToast: (msg: string) => void;
}

const FILTERS: { key: PhotoFilter; label: string }[] = [
  { key: 'all', label: 'All photos' },
  { key: 'selected', label: 'Selected' },
  { key: 'unselected', label: 'Unselected' },
];

const MARKS: { type: SelectionType; label: string }[] = [
  { type: 'bride', label: '♡ Bride' },
  { type: 'groom', label: '◇ Groom' },
  { type: 'both', label: '✦ Both' },
];

export function ClientView({
  album,
  onMark,
  onSubmit,
  onExit,
  showToast,
}: ClientViewProps) {
  const gallery = useDriveGallery(album);
  const [filter, setFilter] = useState<PhotoFilter>('all');
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const counts = selectionCounts(album);
  const total = counts.bride + counts.groom + counts.both;

  const activeFolderName =
    gallery.folders.find((f) => f.id === gallery.activeFolderId)?.name ?? '';

  const visiblePhotos = useMemo(() => {
    let list = gallery.photos;
    if (filter === 'selected') list = list.filter((p) => album.selections[p.id]);
    if (filter === 'unselected')
      list = list.filter((p) => !album.selections[p.id]);
    return list;
  }, [gallery.photos, filter, album.selections]);

  const zoomPhoto: DrivePhoto | null = zoomId
    ? (gallery.photos.find((p) => p.id === zoomId) ?? null)
    : null;

  function handleSubmit() {
    if (album.locked) return;
    if (Object.keys(album.selections).length === 0) {
      showToast('Select at least one photo before submitting.');
      return;
    }
    setConfirming(true);
  }

  function confirmSubmit() {
    setConfirming(false);
    onSubmit();
  }

  return (
    <section id="clientView">
      <header className="clientHeader">
        <a
          className="clientBrand"
          href="https://magicframes.co.in"
          target="_blank"
          rel="noopener noreferrer"
        >
          <BrandMark src="/logotrans.png" imgClassName="headerLogo" />
          <div className="brandName">magicframes.co.in</div>
        </a>
        <div className="clientHeadRight">
          <SocialIcons />
          <button className="btn outline small" onClick={onExit}>
            Exit album
          </button>
        </div>
      </header>

      <div className="clientHero">
        <div>
          <div className="eyebrow">A STORY IN EVERY FRAME</div>
          <h1 className="script">{album.name}</h1>
          <p>{album.subtitle.toUpperCase()}</p>
        </div>
      </div>

      <main className="clientBody">
        {album.locked && (
          <div className="lockBanner">
            ✓ Final selections have been submitted and locked. Contact Magic Frames
            if you need a change.
          </div>
        )}

        <div className="welcomeRow">
          <div>
            <div className="eyebrow">YOUR PRIVATE ALBUM</div>
            <h2>Choose the moments that matter</h2>
            <div className="muted tiny" style={{ color: '#aaa' }}>
              {album.subtitle} · Mark each photograph for the bride, groom or both.
            </div>
          </div>
          <div className="selectionStats">
            <span className="countPill">
              Bride <b>{counts.bride}</b>
            </span>
            <span className="countPill">
              Groom <b>{counts.groom}</b>
            </span>
            <span className="countPill">
              Both <b>{counts.both}</b>
            </span>
            <span className="countPill">
              Total <b>{total}</b>
            </span>
          </div>
        </div>

        {gallery.error && (
          <div className="lockBanner" style={{ borderColor: '#7a3b3b', color: '#e6a0a0', background: '#211313' }}>
            Could not load photos from Google Drive: {gallery.error}
          </div>
        )}

        <div className="folderBar">
          {gallery.loadingFolders ? (
            <span className="muted tiny">Loading events…</span>
          ) : gallery.folders.length === 0 ? (
            <span className="muted tiny">No event folders found.</span>
          ) : (
            gallery.folders.map((f) => (
              <button
                key={f.id}
                className={
                  'folderTab' + (f.id === gallery.activeFolderId ? ' active' : '')
                }
                onClick={() => gallery.setActiveFolderId(f.id)}
              >
                {f.name}
              </button>
            ))
          )}
        </div>

        <div className="galleryToolbar">
          <h3>{activeFolderName ? activeFolderName + ' photographs' : 'Photographs'}</h3>
          <div className="filterButtons">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={'filterBtn' + (filter === f.key ? ' active' : '')}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="photoGrid">
          {gallery.loadingPhotos ? (
            <div className="empty" style={{ gridColumn: '1/-1', color: '#aaa' }}>
              Loading photos…
            </div>
          ) : visiblePhotos.length === 0 ? (
            <div className="empty" style={{ gridColumn: '1/-1', color: '#aaa' }}>
              No photos in this view yet.
            </div>
          ) : (
            visiblePhotos.map((p) => {
              const mark = album.selections[p.id];
              return (
                <article
                  className={'photoCard' + (mark ? ' marked' : '')}
                  key={p.id}
                >
                  <div className="photoThumb">
                    <img
                      src={p.thumbnail ?? p.url}
                      alt={p.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      className="zoomBtn"
                      aria-label={'Zoom ' + p.name}
                      onClick={() => setZoomId(p.id)}
                    >
                      ⌕
                    </button>
                    {mark && (
                      <span className="photoBadge">{mark.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="photoMeta">
                    <div className="photoName" title={p.name}>
                      {p.name}
                    </div>
                    <div className="markRow">
                      {MARKS.map((m) => (
                        <button
                          key={m.type}
                          className={
                            'markBtn ' +
                            m.type +
                            (mark === m.type ? ' selected' : '')
                          }
                          disabled={album.locked}
                          onClick={() => onMark(p.id, m.type)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="bottomSubmit">
          <div>
            <strong
              className="serif"
              style={{ fontSize: 19, fontWeight: 400 }}
            >
              Ready to finalise?
            </strong>
            <p>
              Review your selections before submitting. This will lock edits for
              this album.
            </p>
          </div>
          <button
            className="btn goldbtn"
            disabled={album.locked}
            onClick={handleSubmit}
          >
            {album.locked
              ? 'SELECTIONS LOCKED ✓'
              : 'SUBMIT FINAL SELECTIONS →'}
          </button>
        </div>
      </main>

      <footer className="clientFooter">
        <BrandMark src="/logotrans.png" imgClassName="footerLogo" />
        <div>
          Captured with care ·{' '}
          <a
            className="gold"
            href="https://magicframes.co.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            MAGICFRAMES.CO.IN
          </a>
        </div>
      </footer>

      {zoomPhoto && (
        <div
          className="modalBack"
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoomId(null);
          }}
        >
          <div className="modal zoomModal">
            <div className="zoomCaption">
              <span>
                {zoomPhoto.name}{' '}
                {album.selections[zoomPhoto.id]
                  ? '· ' + album.selections[zoomPhoto.id].toUpperCase()
                  : ''}
              </span>
              <button className="closeBtn" onClick={() => setZoomId(null)}>
                ×
              </button>
            </div>
            <img
              src={zoomPhoto.url}
              alt={zoomPhoto.name}
              referrerPolicy="no-referrer"
            />
            <div className="zoomCaption">
              <span className="muted">Select this photo for:</span>
              <div className="markRow" style={{ width: 'min(360px,65%)' }}>
                {MARKS.map((m) => (
                  <button
                    key={m.type}
                    className={
                      'markBtn ' +
                      m.type +
                      (album.selections[zoomPhoto.id] === m.type
                        ? ' selected'
                        : '')
                    }
                    disabled={album.locked}
                    onClick={() => onMark(zoomPhoto.id, m.type)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modalBack">
          <div className="modal">
            <div className="modalHead">
              <h2>Submit final selections?</h2>
              <button className="closeBtn" onClick={() => setConfirming(false)}>
                ×
              </button>
            </div>
            <p>
              This will lock editing for <b>{album.name}</b>. The studio admin can
              then download Bride, Groom and Both lists separately.
            </p>
            <div className="selectionStats" style={{ margin: '18px 0' }}>
              <span className="countPill">
                Bride <b>{counts.bride}</b>
              </span>
              <span className="countPill">
                Groom <b>{counts.groom}</b>
              </span>
              <span className="countPill">
                Both <b>{counts.both}</b>
              </span>
            </div>
            <div
              style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}
            >
              <button
                className="btn outline"
                onClick={() => setConfirming(false)}
              >
                Go back
              </button>
              <button className="btn goldbtn" onClick={confirmSubmit}>
                Confirm &amp; lock
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
