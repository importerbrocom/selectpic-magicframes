import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BrandMark } from './BrandMark';
import {
  selectedPhotos,
  selectionCounts,
  selectionStatus,
} from './helpers';
import {
  downloadSelectedZip,
  getApiKey,
  listImages,
  listSubFolders,
  parseFolderId,
  thumbUrl,
} from './drive';
import { photos } from './data';
import { StaffView } from './StaffView';
import { ProfileView, loadProfile } from './ProfileView';
import { SettingsView } from './SettingsView';
import type { Album, AdminTab, SelectionType, StaffMember } from './types';

interface AdminViewProps {
  albums: Album[];
  staff: StaffMember[];
  onCreateAlbum: (album: Omit<Album, 'id'>) => number;
  onUpdateAlbum: (id: number, patch: Partial<Album>) => void;
  onDeleteAlbum: (id: number) => void;
  onAddStaff: (data: Omit<StaffMember, 'id' | 'status'>) => boolean;
  onUpdateStaff: (id: number, patch: Partial<StaffMember>) => void;
  onDeleteStaff: (id: number) => void;
  onOpenClientGate: (id: number) => void;
  onLogout: () => void;
  showToast: (msg: string) => void;
}

const NAV: { tab: AdminTab; icon: string; label: string }[] = [
  { tab: 'dashboard', icon: '◧', label: 'Dashboard' },
  { tab: 'albums', icon: '▦', label: 'Albums' },
  { tab: 'create', icon: '＋', label: 'Create' },
  { tab: 'staff', icon: '♟', label: 'Staff' },
  { tab: 'profile', icon: '◎', label: 'Profile' },
  { tab: 'settings', icon: '⚙', label: 'Settings' },
];

function titleFor(tab: AdminTab): string {
  if (tab === 'create') return 'Create Album';
  return tab[0].toUpperCase() + tab.slice(1);
}

/** Meta line for an album card: photo count + how many have been selected. */
function albumMeta(a: Album): string {
  const made = Object.keys(a.selections ?? {}).length;
  const photoPart = a.photos
    ? `${a.photos.toLocaleString()} photos`
    : a.driveFolderId
      ? 'Drive folder'
      : 'Demo photos';
  const selPart = made > 0 ? `${made} selected` : 'None selected yet';
  return `${photoPart} · ${selPart}`;
}

export function AdminView({
  albums,
  staff,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onOpenClientGate,
  onLogout,
  showToast,
}: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingStaff, setAddingStaff] = useState(false);

  // Create / edit form state.
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDriveLink, setNewDriveLink] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newAllowDownload, setNewAllowDownload] = useState(false);

  const statusCounts = useMemo(() => {
    let awaiting = 0;
    let inProgress = 0;
    let submitted = 0;
    for (const a of albums) {
      const tone = selectionStatus(a).tone;
      if (tone === 'done') submitted += 1;
      else if (tone === 'active') inProgress += 1;
      else awaiting += 1;
    }
    return { awaiting, inProgress, submitted };
  }, [albums]);

  const filteredAlbums = useMemo(() => {
    const q = search.toLowerCase();
    return albums.filter((a) => a.name.toLowerCase().includes(q));
  }, [albums, search]);

  const detailAlbum = albums.find((a) => a.id === detailId) ?? null;
  const deletingAlbum = albums.find((a) => a.id === deletingId) ?? null;

  function startEdit(album: Album) {
    setEditingId(album.id);
    setNewName(album.name);
    setNewSubtitle(album.subtitle);
    setNewPassword(album.password);
    setNewDriveLink(album.driveLink);
    setNewCover(album.cover);
    setNewAllowDownload(Boolean(album.allowDownload));
    setTab('create');
  }

  function resetForm() {
    setEditingId(null);
    setNewName('');
    setNewSubtitle('');
    setNewPassword('');
    setNewCover('');
    setNewDriveLink('');
    setNewAllowDownload(false);
  }

  function openCreate() {
    resetForm();
    setTab('create');
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    const driveLink = newDriveLink.trim();
    const driveFolderId = parseFolderId(driveLink);

    if (driveLink && !driveFolderId) {
      showToast('That does not look like a valid Google Drive folder link.');
      return;
    }

    if (editingId != null) {
      onUpdateAlbum(editingId, {
        name,
        subtitle: newSubtitle.trim() || 'A Story in Every Frame',
        password: newPassword.trim(),
        driveLink,
        driveFolderId,
        cover: newCover.trim() || photos[0].url,
        allowDownload: newAllowDownload,
      });
      const id = editingId;
      resetForm();
      setTab('albums');
      setDetailId(id);
      showToast('Album updated.');
      return;
    }

    onCreateAlbum({
      name,
      subtitle: newSubtitle.trim() || 'A Story in Every Frame',
      password: newPassword.trim(),
      driveLink,
      driveFolderId,
      photos: driveFolderId ? 0 : photos.length,
      // Drive albums start with no cover so the first Drive photo auto-fills
      // it; demo albums use a bundled cover.
      cover: newCover.trim() || (driveFolderId ? '' : photos[0].url),
      status: 'In progress',
      views: 0,
      locked: false,
      selections: {},
      allowDownload: newAllowDownload,
    });
    resetForm();
    setTab('albums');
    showToast('Private album created. Unique link and password are ready.');
  }

  function copyPrivateLink(link: string) {
    const write = navigator.clipboard?.writeText(link);
    if (write) {
      write
        .then(() => showToast('Private link copied'))
        .catch(() => showToast('Copy the link manually'));
    } else {
      showToast('Copy the link manually');
    }
  }

  return (
    <section id="adminView" data-theme="modern">
      <aside className="sidebar">
        <div className="sideLogo sideLogo--image">
          <BrandMark src="/logo.png" imgClassName="sideLogoImg" />
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.tab}
              className={tab === item.tab ? 'active' : ''}
              onClick={() => {
                setDetailId(null);
                if (item.tab !== 'create') resetForm();
                setTab(item.tab);
              }}
            >
              <span className="ico">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          <b>Studio Admin</b>
          <div className="muted tiny" style={{ marginTop: 4 }}>
            admin@magicframes.test
          </div>
          <button className="logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="adminMain">
        <div className="topline">
          <h1>
            {tab === 'create' && editingId != null
              ? 'Edit Album'
              : tab === 'albums' && detailAlbum
                ? detailAlbum.name
                : tab === 'profile'
                  ? 'My Profile'
                  : titleFor(tab)}
          </h1>
          {tab === 'staff' ? (
            <button className="btn" onClick={() => setAddingStaff(true)}>
              ＋ Add staff
            </button>
          ) : tab === 'dashboard' || (tab === 'albums' && !detailAlbum) ? (
            <button className="btn" onClick={openCreate}>
              ＋ New Album
            </button>
          ) : null}
        </div>

        {/* Dashboard */}
        <div className={'adminContent' + (tab === 'dashboard' ? ' active' : '')}>
          <div className="stats">
            <div className="panel stat">
              <div className="label">TOTAL ALBUMS</div>
              <strong>{albums.length}</strong>
            </div>
            <div className="panel stat">
              <div className="label">AWAITING SELECTION</div>
              <strong>{statusCounts.awaiting}</strong>
            </div>
            <div className="panel stat">
              <div className="label">IN PROGRESS</div>
              <strong>{statusCounts.inProgress}</strong>
            </div>
            <div className="panel stat">
              <div className="label">SUBMITTED</div>
              <strong>{statusCounts.submitted}</strong>
            </div>
          </div>
          <h2 className="sectionTitle">Recent Albums</h2>
          <div className="albumGrid">
            {albums.slice(0, 5).map((a) => (
              <article
                className="panel albumCard clickable"
                key={a.id}
                onClick={() => {
                  setDetailId(a.id);
                  setTab('albums');
                }}
              >
                {a.cover ? (
                  <img src={a.cover} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="coverPlaceholder cardCoverPlaceholder" />
                )}
                <div className="albumInfo">
                  <div className="albumCardHead">
                    <h3>{a.name}</h3>
                    {(() => {
                      const s = selectionStatus(a);
                      return (
                        <span className={'statusPill ' + s.tone}>{s.label}</span>
                      );
                    })()}
                  </div>
                  <p>{a.subtitle}</p>
                  <div className="albumMeta">{albumMeta(a)}</div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Albums */}
        <div className={'adminContent' + (tab === 'albums' ? ' active' : '')}>
          {detailAlbum ? (
            <AlbumDetail
              album={detailAlbum}
              onBack={() => setDetailId(null)}
              onView={() => onOpenClientGate(detailAlbum.id)}
              onSync={() => {
                onUpdateAlbum(detailAlbum.id, {
                  lastSynced: new Date().toISOString(),
                });
                showToast(
                  detailAlbum.driveFolderId
                    ? 'Synced with Google Drive.'
                    : 'Nothing to sync — this album uses demo photos.',
                );
              }}
              onEdit={() => startEdit(detailAlbum)}
              onToggleDisabled={() => {
                const nowLocked = !detailAlbum.locked;
                onUpdateAlbum(detailAlbum.id, {
                  locked: nowLocked,
                  status: nowLocked ? 'Selections submitted' : 'In progress',
                });
                showToast(
                  nowLocked
                    ? 'Selections closed — the client can no longer edit.'
                    : 'Selections reopened for the client.',
                );
              }}
              onDelete={() => setDeletingId(detailAlbum.id)}
              onCopyLink={copyPrivateLink}
              onDriveResolved={({ photos, cover }) => {
                const patch: Partial<Album> = {};
                if (photos && photos !== detailAlbum.photos)
                  patch.photos = photos;
                // For Drive albums, always keep the cover pointed at the first
                // Drive photo (replaces any stale/empty value).
                if (cover && cover !== detailAlbum.cover) patch.cover = cover;
                if (Object.keys(patch).length) {
                  onUpdateAlbum(detailAlbum.id, patch);
                }
              }}
              onToggleDownloads={(allow) => {
                onUpdateAlbum(detailAlbum.id, { allowDownload: allow });
                showToast(
                  allow
                    ? 'Client photo downloads enabled.'
                    : 'Client photo downloads disabled.',
                );
              }}
              showToast={showToast}
            />
          ) : (
            <>
              <input
                className="albumSearch"
                placeholder="Search by client or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {filteredAlbums.length === 0 ? (
                <div className="empty">No albums found.</div>
              ) : (
                <div className="albumGrid">
                  {filteredAlbums.map((a) => (
                    <article
                      className="panel albumCard clickable"
                      key={a.id}
                      onClick={() => setDetailId(a.id)}
                    >
                      {a.cover ? (
                        <img
                          src={a.cover}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="coverPlaceholder cardCoverPlaceholder" />
                      )}
                      <div className="albumInfo">
                        <div className="albumCardHead">
                          <h3>{a.name}</h3>
                          {(() => {
                            const s = selectionStatus(a);
                            return (
                              <span className={'statusPill ' + s.tone}>
                                {s.label}
                              </span>
                            );
                          })()}
                        </div>
                        <p>{a.subtitle}</p>
                        <div className="albumMeta">{albumMeta(a)}</div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Create */}
        <div className={'adminContent' + (tab === 'create' ? ' active' : '')}>
          <div className="panel formCard" style={{ maxWidth: 760 }}>
            <h2 className="sectionTitle">
              {editingId != null
                ? 'Edit selection album'
                : 'Create a selection album'}
            </h2>
            <p className="muted">
              {editingId != null
                ? 'Update this album’s details, password or Drive folder.'
                : 'Set up a private album the couple can open to select their photos.'}
            </p>
            <form className="createForm" onSubmit={handleCreate}>
              <div className="field">
                <label>Client / Couple name *</label>
                <input
                  placeholder="e.g. Job Maya"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Album subtitle</label>
                <input
                  placeholder="The Beginning of Forever"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Private password *</label>
                <input
                  placeholder="Set a unique password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>

              <div className="formSection">
                <div className="formSectionLabel">PHOTO GALLERY</div>
                <div className="field">
                  <label>Google Drive Folder Link (photos)</label>
                  <input
                    placeholder="https://drive.google.com/drive/folders/…"
                    value={newDriveLink}
                    onChange={(e) => setNewDriveLink(e.target.value)}
                  />
                  <span className="muted tiny">
                    Paste the parent Drive folder. Each sub-folder becomes an
                    event tab (Haldi, Engagement, Wedding…). The folder must be
                    shared as “Anyone with the link”.
                  </span>
                </div>
              </div>

              <div className="field">
                <label>Cover image URL (optional)</label>
                <input
                  placeholder="https://…"
                  value={newCover}
                  onChange={(e) => setNewCover(e.target.value)}
                />
              </div>
              <label className="remember">
                <input
                  type="checkbox"
                  checked={newAllowDownload}
                  onChange={(e) => setNewAllowDownload(e.target.checked)}
                />{' '}
                Allow the client to download photos
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn goldbtn">
                  {editingId != null ? 'Save changes' : 'Create private album'}
                </button>
                {editingId != null && (
                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => {
                      const id = editingId;
                      resetForm();
                      setTab('albums');
                      setDetailId(id);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Staff */}
        <div className={'adminContent' + (tab === 'staff' ? ' active' : '')}>
          <StaffView
            staff={staff}
            adding={addingStaff}
            setAdding={setAddingStaff}
            onAdd={onAddStaff}
            onUpdate={onUpdateStaff}
            onDelete={onDeleteStaff}
            showToast={showToast}
          />
        </div>

        {/* Profile */}
        <div className={'adminContent' + (tab === 'profile' ? ' active' : '')}>
          <ProfileView showToast={showToast} />
        </div>

        {/* Settings */}
        <div className={'adminContent' + (tab === 'settings' ? ' active' : '')}>
          <SettingsView
            adminName={loadProfile().name}
            adminEmail={loadProfile().email}
            onEditProfile={() => {
              setDetailId(null);
              setTab('profile');
            }}
            onManageStaff={() => {
              setDetailId(null);
              setTab('staff');
            }}
            showToast={showToast}
          />
        </div>
      </main>

      {deletingAlbum && (
        <div
          className="modalBack"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingId(null);
          }}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modalHead">
              <h2>Delete album?</h2>
              <button className="closeBtn" onClick={() => setDeletingId(null)}>
                ×
              </button>
            </div>
            <p>
              This permanently removes <b>{deletingAlbum.name}</b> and its
              selections. This cannot be undone.
            </p>
            <div
              style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}
            >
              <button className="btn outline" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const name = deletingAlbum.name;
                  onDeleteAlbum(deletingAlbum.id);
                  setDeletingId(null);
                  setDetailId(null);
                  showToast(`Deleted “${name}”.`);
                }}
              >
                Delete album
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface AlbumDetailProps {
  album: Album;
  onBack: () => void;
  onView: () => void;
  onSync: () => void;
  onEdit: () => void;
  onToggleDisabled: () => void;
  onDelete: () => void;
  onCopyLink: (link: string) => void;
  onDriveResolved: (info: { photos: number; cover: string | null }) => void;
  onToggleDownloads: (allow: boolean) => void;
  showToast: (msg: string) => void;
}

function AlbumDetail({
  album,
  onBack,
  onView,
  onSync,
  onEdit,
  onToggleDisabled,
  onDelete,
  onCopyLink,
  onDriveResolved,
  onToggleDownloads,
  showToast,
}: AlbumDetailProps) {
  const shareLink = `${location.href.split('#')[0]}#client-${album.id}`;
  const counts = selectionCounts(album);
  const totalSelected = counts.bride + counts.groom + counts.both;
  const status = selectionStatus(album);
  const allSelected = selectedPhotos(album);
  const [selFilter, setSelFilter] = useState<'all' | SelectionType>('all');
  const [downloading, setDownloading] = useState<string | null>(null);
  const shownSelected =
    selFilter === 'all'
      ? allSelected
      : allSelected.filter((p) => p.type === selFilter);

  async function downloadSelected(type: 'all' | SelectionType) {
    if (!album.driveFolderId) {
      showToast('Photo download works only for Google Drive albums.');
      return;
    }
    const files = allSelected
      .filter((p) => (type === 'all' ? true : p.type === type))
      .map((p) => ({ file_id: p.id, file_name: p.name }));
    if (files.length === 0) {
      showToast(
        type === 'all'
          ? 'No photos selected yet.'
          : `No ${type.toUpperCase()} photos selected.`,
      );
      return;
    }
    setDownloading(type);
    showToast(
      `Preparing a ZIP of ${files.length} ${type === 'all' ? '' : type.toUpperCase() + ' '}photo${files.length === 1 ? '' : 's'}…`,
    );
    try {
      await downloadSelectedZip(album.name, type, files);
      showToast('Download ready.');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(shareLink)}`;

  const eventsLabel = album.events?.length
    ? String(album.events.length)
    : album.driveFolderId
      ? 'Drive'
      : '—';

  const lastSynced = album.lastSynced
    ? new Date(album.lastSynced).toLocaleString()
    : 'Never';

  return (
    <div className="albumDetail">
      <button className="backLink" onClick={onBack}>
        ‹ Back to albums
      </button>

      <div className="detailGrid">
        {/* Left: album summary + actions */}
        <div className="panel detailMain">
          {album.cover ? (
            <img
              className="detailCover"
              src={album.cover}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="detailCover coverPlaceholder">
              {album.driveFolderId ? 'Loading cover…' : 'No cover image'}
            </div>
          )}
          <div className="detailBody">
            <div className="detailTitleRow">
              <div>
                <h2 className="detailName">{album.name}</h2>
                <p className="detailSubtitle">{album.subtitle}</p>
              </div>
              <span className={'statusPill ' + status.tone}>{status.label}</span>
            </div>

            <div className="detailStats">
              <div>
                <div className="detailStatLabel">PHOTOS</div>
                <div className="detailStatValue">
                  {album.photos ? album.photos.toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div className="detailStatLabel">SELECTED</div>
                <div className="detailStatValue">{totalSelected}</div>
              </div>
              <div>
                <div className="detailStatLabel">EVENTS</div>
                <div className="detailStatValue">{eventsLabel}</div>
              </div>
              <div>
                <div className="detailStatLabel">DRIVE</div>
                <div className="detailStatValue">
                  {album.driveFolderId ? 'Connected' : 'Not linked'}
                </div>
              </div>
            </div>

            <div className="muted tiny" style={{ marginBottom: 18 }}>
              Last synced: {lastSynced}
            </div>

            {album.driveFolderId && (
              <DriveStatus
                folderId={album.driveFolderId}
                onResolved={onDriveResolved}
              />
            )}

            <div className="detailActions">
              <button className="btn" onClick={onView}>
                Preview selection page
              </button>
              <button className="btn outline" onClick={onSync}>
                Sync photos
              </button>
              <button className="btn outline" onClick={onEdit}>
                Edit
              </button>
              <button className="btn outline" onClick={onToggleDisabled}>
                {album.locked ? 'Reopen selections' : 'Close selections'}
              </button>
              <button
                className="btn outline"
                onClick={() => onToggleDownloads(!album.allowDownload)}
              >
                {album.allowDownload
                  ? 'Downloads: On'
                  : 'Downloads: Off'}
              </button>
              <button className="btn outline detailDelete" onClick={onDelete}>
                Delete
              </button>
            </div>

            <div className="detailExport">
              <div className="formSectionLabel" style={{ marginBottom: 10 }}>
                DOWNLOAD SELECTED PHOTOS (ZIP)
              </div>
              <div className="detailExportRow">
                <button
                  className="btn small"
                  disabled={!!downloading}
                  onClick={() => downloadSelected('bride')}
                >
                  {downloading === 'bride'
                    ? 'Zipping…'
                    : `Bride (${counts.bride})`}
                </button>
                <button
                  className="btn small"
                  disabled={!!downloading}
                  onClick={() => downloadSelected('groom')}
                >
                  {downloading === 'groom'
                    ? 'Zipping…'
                    : `Groom (${counts.groom})`}
                </button>
                <button
                  className="btn small"
                  disabled={!!downloading}
                  onClick={() => downloadSelected('both')}
                >
                  {downloading === 'both'
                    ? 'Zipping…'
                    : `Both (${counts.both})`}
                </button>
                <button
                  className="btn small"
                  disabled={!!downloading}
                  onClick={() => downloadSelected('all')}
                >
                  {downloading === 'all'
                    ? 'Zipping…'
                    : `All (${totalSelected})`}
                </button>
              </div>
              {!album.driveFolderId && (
                <p className="muted tiny" style={{ marginTop: 10 }}>
                  Photo download is available for Google Drive albums.
                </p>
              )}
            </div>
          </div>

          {/* Selected photos */}
          <div className="panel detailCard detailSelected">
            <div className="selectedHead">
              <h3 className="detailCardTitle" style={{ margin: 0 }}>
                Selected photos ({allSelected.length})
              </h3>
              {allSelected.length > 0 && (
                <div className="filterButtons light">
                  {(['all', 'bride', 'groom', 'both'] as const).map((f) => (
                    <button
                      key={f}
                      className={
                        'filterBtn' + (selFilter === f ? ' active' : '')
                      }
                      onClick={() => setSelFilter(f)}
                    >
                      {f === 'all'
                        ? 'All'
                        : f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {allSelected.length === 0 ? (
              <p className="muted tiny" style={{ marginTop: 12 }}>
                The client hasn’t selected any photos yet. Open “Preview as
                client” to try it.
              </p>
            ) : shownSelected.length === 0 ? (
              <p className="muted tiny" style={{ marginTop: 12 }}>
                No “{selFilter}” selections.
              </p>
            ) : (
              <div className="selectedGrid">
                {shownSelected.map((p) => (
                  <a
                    className="selectedCard"
                    key={p.id}
                    href={
                      album.driveFolderId
                        ? thumbUrl(p.id, 1600)
                        : p.thumbnail
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title={'View ' + p.name}
                  >
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span className={'selTag ' + p.type}>
                      {p.type.toUpperCase()}
                    </span>
                    <span className="viewHint">⌕ View</span>
                    <figcaption>{p.name}</figcaption>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: selection link + selection progress */}
        <div className="detailSide">
          <div className="panel detailCard">
            <h3 className="detailCardTitle">Client Selection Link</h3>
            <p className="muted tiny" style={{ marginTop: -6, marginBottom: 12 }}>
              Send this private link to the couple so they can mark their photos.
            </p>
            <div className="formSectionLabel">SELECTION LINK</div>
            <div className="shareRow">
              <input readOnly value={shareLink} />
              <button
                className="btn small"
                onClick={() => onCopyLink(shareLink)}
              >
                Copy
              </button>
            </div>
            <div className="formSectionLabel" style={{ marginTop: 14 }}>
              ALBUM PASSWORD
            </div>
            <div className="shareRow">
              <input readOnly value={album.password} />
              <button
                className="btn small"
                onClick={() => onCopyLink(album.password)}
              >
                Copy
              </button>
            </div>
            <button
              className="btn"
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => {
                const text =
                  `Hi! Your "${album.name}" photo selection album is ready. ` +
                  `Open this link to choose your photos:\n${shareLink}\n` +
                  `Password: ${album.password}`;
                window.open(
                  'https://wa.me/?text=' + encodeURIComponent(text),
                  '_blank',
                  'noopener',
                );
              }}
            >
              Share on WhatsApp
            </button>
            <button
              className="btn outline"
              style={{ width: '100%', marginTop: 10 }}
              onClick={onView}
            >
              Preview as client
            </button>
            <div className="formSectionLabel" style={{ marginTop: 18 }}>
              SCAN TO OPEN
            </div>
            <img
              className="detailQr"
              src={qrSrc}
              alt={'QR code for ' + album.name}
              width={160}
              height={160}
              onError={() =>
                showToast('QR preview needs an internet connection.')
              }
            />
          </div>

          <div className="panel detailCard">
            <h3 className="detailCardTitle">Selection progress</h3>
            <div className="analyticsGrid">
              <div>
                <div className="detailStatLabel">TOTAL SELECTED</div>
                <div className="detailStatValue">{totalSelected}</div>
              </div>
              <div>
                <div className="detailStatLabel">BRIDE</div>
                <div className="detailStatValue">{counts.bride}</div>
              </div>
              <div>
                <div className="detailStatLabel">GROOM</div>
                <div className="detailStatValue">{counts.groom}</div>
              </div>
              <div>
                <div className="detailStatLabel">BOTH</div>
                <div className="detailStatValue">{counts.both}</div>
              </div>
            </div>
            <p className="muted tiny" style={{ marginTop: 14 }}>
              {album.locked
                ? 'Selections submitted and locked by the client.'
                : totalSelected > 0
                  ? 'The client has started selecting photos.'
                  : 'Waiting for the client to begin selecting.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DriveStatusState {
  loading: boolean;
  error: string | null;
  folders: number;
  photos: number;
}

/**
 * Live Google Drive diagnostic shown on the album detail page. Fetches the
 * folder's sub-folders and counts images, surfacing the exact Google error so
 * studio staff can see why photos aren't loading.
 */
function DriveStatus({
  folderId,
  onResolved,
}: {
  folderId: string;
  onResolved?: (info: { photos: number; cover: string | null }) => void;
}) {
  const [state, setState] = useState<DriveStatusState>({
    loading: true,
    error: null,
    folders: 0,
    photos: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const key = getApiKey();

    if (!key) {
      setState({
        loading: false,
        error:
          'No API key in this build (VITE_GOOGLE_API_KEY). Rebuild after setting it in frontend/.env.',
        folders: 0,
        photos: 0,
      });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const subs = await listSubFolders(folderId, key);
        // Count images in the parent itself plus each sub-folder.
        const targets = subs.length ? subs.map((s) => s.id) : [folderId];
        let total = 0;
        let cover: string | null = null;
        for (const id of targets) {
          const imgs = await listImages(id, key);
          // Use a moderate cover size (more reliable than very large).
          if (!cover && imgs.length) cover = thumbUrl(imgs[0].id, 800);
          total += imgs.length;
        }
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            folders: subs.length,
            photos: total,
          });
          onResolved?.({ photos: total, cover });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            error: (e as Error).message,
            folders: 0,
            photos: 0,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  if (state.loading) {
    return (
      <div className="driveStatus checking">Checking Google Drive…</div>
    );
  }

  if (state.error) {
    return (
      <div className="driveStatus bad">
        <b>Drive error:</b> {state.error}
        <div className="driveHint">
          Check: the folder is shared “Anyone with the link”, the API key allows
          this domain, and the Google Drive API is enabled.
        </div>
      </div>
    );
  }

  if (state.photos === 0) {
    return (
      <div className="driveStatus warn">
        Connected, but <b>0 photos</b> found. Make sure the folder (and its
        sub-folders) are shared “Anyone with the link” and contain images.
      </div>
    );
  }

  return (
    <div className="driveStatus ok">
      ✓ {state.photos} photo{state.photos === 1 ? '' : 's'} found
      {state.folders > 0
        ? ` across ${state.folders} event folder${state.folders === 1 ? '' : 's'}`
        : ' in the folder'}
      .
    </div>
  );
}
