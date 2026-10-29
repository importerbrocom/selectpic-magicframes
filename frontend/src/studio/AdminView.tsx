import { useMemo, useState, type FormEvent } from 'react';
import { BrandMark } from './BrandMark';
import { downloadAlbumCSV, selectionCounts } from './helpers';
import { parseFolderId } from './drive';
import { photos } from './data';
import type { Album, AdminTab, SelectionType } from './types';

interface AdminViewProps {
  albums: Album[];
  onCreateAlbum: (album: Omit<Album, 'id'>) => number;
  onUpdateAlbum: (id: number, patch: Partial<Album>) => void;
  onDeleteAlbum: (id: number) => void;
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

export function AdminView({
  albums,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  onOpenClientGate,
  onLogout,
  showToast,
}: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Create / edit form state.
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDriveLink, setNewDriveLink] = useState('');
  const [newCover, setNewCover] = useState('');

  const totalPhotos = useMemo(
    () => albums.reduce((sum, a) => sum + a.photos, 0),
    [albums],
  );
  const activeCount = useMemo(
    () => albums.filter((a) => !a.locked).length,
    [albums],
  );

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
    setTab('create');
  }

  function resetForm() {
    setEditingId(null);
    setNewName('');
    setNewSubtitle('');
    setNewPassword('');
    setNewCover('');
    setNewDriveLink('');
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
      cover: newCover.trim() || photos[0].url,
      status: 'In progress',
      views: 0,
      locked: false,
      selections: {},
    });
    resetForm();
    setTab('albums');
    showToast('Private album created. Unique link and password are ready.');
  }

  function exportCSV(album: Album, type: 'all' | SelectionType) {
    const ok = downloadAlbumCSV(album, type);
    if (!ok) {
      showToast(
        type === 'all'
          ? 'No photos marked yet.'
          : 'No photos marked for ' + type.toUpperCase() + ' yet.',
      );
    } else {
      showToast(
        (type === 'all' ? 'ALL' : type.toUpperCase()) +
          ' selection CSV downloaded',
      );
    }
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
        <div className="sideLogo">
          <BrandMark />
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
                : titleFor(tab)}
          </h1>
          <button className="btn" onClick={openCreate}>
            ＋ New Album
          </button>
        </div>

        {/* Dashboard */}
        <div className={'adminContent' + (tab === 'dashboard' ? ' active' : '')}>
          <div className="stats">
            <div className="panel stat">
              <div className="label">TOTAL ALBUMS</div>
              <strong>{albums.length}</strong>
            </div>
            <div className="panel stat">
              <div className="label">ACTIVE</div>
              <strong>{activeCount}</strong>
            </div>
            <div className="panel stat">
              <div className="label">PHOTOS</div>
              <strong>{totalPhotos.toLocaleString()}</strong>
            </div>
            <div className="panel stat">
              <div className="label">ALBUM VIEWS</div>
              <strong>{albums.reduce((s, a) => s + a.views, 0)}</strong>
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
                <img src={a.cover} alt="" />
                <div className="albumInfo">
                  <div className="albumCardHead">
                    <h3>{a.name}</h3>
                    <span className={'statusPill ' + (a.locked ? 'off' : 'on')}>
                      {a.locked ? 'Disabled' : 'Active'}
                    </span>
                  </div>
                  <p>{a.subtitle}</p>
                  <div className="albumMeta">
                    {a.photos ? a.photos.toLocaleString() + ' photos' : 'Drive album'}
                    {' · '}
                    {a.events?.length
                      ? a.events.length + ' events'
                      : a.driveFolderId
                        ? 'Drive'
                        : 'Demo'}
                  </div>
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
                  status: nowLocked ? 'Disabled' : 'In progress',
                });
                showToast(nowLocked ? 'Album disabled.' : 'Album enabled.');
              }}
              onDelete={() => setDeletingId(detailAlbum.id)}
              onCopyLink={copyPrivateLink}
              onExport={exportCSV}
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
                      <img src={a.cover} alt="" />
                      <div className="albumInfo">
                        <div className="albumCardHead">
                          <h3>{a.name}</h3>
                          <span
                            className={'statusPill ' + (a.locked ? 'off' : 'on')}
                          >
                            {a.locked ? 'Disabled' : 'Active'}
                          </span>
                        </div>
                        <p>{a.subtitle}</p>
                        <div className="albumMeta">
                          {a.photos ? a.photos.toLocaleString() + ' photos' : 'Drive album'}
                          {' · '}
                          {a.events?.length
                            ? a.events.length + ' events'
                            : a.driveFolderId
                              ? 'Drive'
                              : 'Demo'}
                        </div>
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
              {editingId != null ? 'Edit album' : 'Create a client album'}
            </h2>
            <p className="muted">
              {editingId != null
                ? 'Update this album’s details, password or Drive folder.'
                : 'Create a private client portal with its own password and unique link.'}
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
          <div className="panel" style={{ padding: 25 }}>
            <h2 className="sectionTitle">Studio staff</h2>
            <p>Manage team access in your production setup.</p>
            <table className="adminTable">
              <tbody>
                <tr>
                  <th>NAME</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                </tr>
                <tr>
                  <td>Studio Admin</td>
                  <td>Administrator</td>
                  <td>
                    <span className="status">Active</span>
                  </td>
                </tr>
                <tr>
                  <td>Photo Editor</td>
                  <td>Editor</td>
                  <td>
                    <span className="status pending">Invite pending</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Profile */}
        <div className={'adminContent' + (tab === 'profile' ? ' active' : '')}>
          <div className="panel" style={{ padding: 25, maxWidth: 650 }}>
            <h2 className="sectionTitle">Studio profile</h2>
            <div className="field">
              <label>Studio name</label>
              <input defaultValue="Magic Frames" />
            </div>
            <div className="field">
              <label>Contact email</label>
              <input defaultValue="admin@magicframes.test" />
            </div>
            <button
              className="btn goldbtn"
              onClick={() => showToast('Profile saved in this demo view.')}
            >
              Save profile
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className={'adminContent' + (tab === 'settings' ? ' active' : '')}>
          <div className="panel" style={{ padding: 25, maxWidth: 650 }}>
            <h2 className="sectionTitle">Settings</h2>
            <p>Client selection rules</p>
            <label className="remember">
              <input type="checkbox" defaultChecked /> Require password for every
              client album
            </label>
            <label className="remember">
              <input type="checkbox" defaultChecked /> Lock selections after final
              submission
            </label>
            <label className="remember">
              <input type="checkbox" defaultChecked /> Allow CSV export by selection
              type
            </label>
            <button
              className="btn goldbtn"
              onClick={() => showToast('Settings saved for this demo.')}
            >
              Save settings
            </button>
          </div>
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
  onExport: (album: Album, type: 'all' | SelectionType) => void;
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
  onExport,
  showToast,
}: AlbumDetailProps) {
  const shareLink = `${location.href.split('#')[0]}#client-${album.id}`;
  const counts = selectionCounts(album);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(shareLink)}`;

  const eventsLabel = album.events?.length
    ? String(album.events.length)
    : album.driveFolderId
      ? 'Drive'
      : '—';

  const lastSynced = album.lastSynced
    ? new Date(album.lastSynced).toLocaleString()
    : 'Never';

  function shareWhatsApp() {
    const text = `View the “${album.name}” photo album: ${shareLink}`;
    window.open(
      'https://wa.me/?text=' + encodeURIComponent(text),
      '_blank',
      'noopener',
    );
  }

  return (
    <div className="albumDetail">
      <button className="backLink" onClick={onBack}>
        ‹ Back to albums
      </button>

      <div className="detailGrid">
        {/* Left: album summary + actions */}
        <div className="panel detailMain">
          <img className="detailCover" src={album.cover} alt="" />
          <div className="detailBody">
            <div className="detailTitleRow">
              <div>
                <h2 className="detailName">{album.name}</h2>
                <p className="detailSubtitle">{album.subtitle}</p>
              </div>
              <span className={'statusPill ' + (album.locked ? 'off' : 'on')}>
                {album.locked ? 'Disabled' : 'Active'}
              </span>
            </div>

            <div className="detailStats">
              <div>
                <div className="detailStatLabel">PHOTOS</div>
                <div className="detailStatValue">
                  {album.photos ? album.photos.toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div className="detailStatLabel">EVENTS</div>
                <div className="detailStatValue">{eventsLabel}</div>
              </div>
              <div>
                <div className="detailStatLabel">FILM</div>
                <div className="detailStatValue">—</div>
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

            <div className="detailActions">
              <button className="btn" onClick={onView}>
                View Album
              </button>
              <button className="btn outline" onClick={onSync}>
                Sync Now
              </button>
              <button className="btn outline" onClick={onEdit}>
                Edit
              </button>
              <button className="btn outline" onClick={onToggleDisabled}>
                {album.locked ? 'Enable' : 'Disable'}
              </button>
              <button className="btn outline detailDelete" onClick={onDelete}>
                Delete
              </button>
            </div>

            <div className="detailExport">
              <div className="formSectionLabel" style={{ marginBottom: 10 }}>
                EXPORT SELECTIONS
              </div>
              <div className="detailExportRow">
                <span className="countPill light">
                  Bride <b>{counts.bride}</b>
                </span>
                <span className="countPill light">
                  Groom <b>{counts.groom}</b>
                </span>
                <span className="countPill light">
                  Both <b>{counts.both}</b>
                </span>
              </div>
              <div className="detailExportRow">
                <button
                  className="btn small outline"
                  onClick={() => onExport(album, 'bride')}
                >
                  Bride CSV
                </button>
                <button
                  className="btn small outline"
                  onClick={() => onExport(album, 'groom')}
                >
                  Groom CSV
                </button>
                <button
                  className="btn small outline"
                  onClick={() => onExport(album, 'both')}
                >
                  Both CSV
                </button>
                <button
                  className="btn small outline"
                  onClick={() => onExport(album, 'all')}
                >
                  All CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: share / analytics / enquiries / comments */}
        <div className="detailSide">
          <div className="panel detailCard">
            <h3 className="detailCardTitle">🎉 Album Ready to Share</h3>
            <div className="formSectionLabel">SHARE LINK</div>
            <div className="shareRow">
              <input readOnly value={shareLink} />
              <button
                className="btn small"
                onClick={() => onCopyLink(shareLink)}
              >
                Copy
              </button>
            </div>
            <button
              className="btn"
              style={{ width: '100%', marginTop: 12 }}
              onClick={shareWhatsApp}
            >
              Share on WhatsApp
            </button>
            <button
              className="btn outline"
              style={{ width: '100%', marginTop: 10 }}
              onClick={onView}
            >
              Open Album
            </button>
            <div className="formSectionLabel" style={{ marginTop: 18 }}>
              QR CODE
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
            <h3 className="detailCardTitle">Analytics</h3>
            <div className="analyticsGrid">
              <div>
                <div className="detailStatLabel">TOTAL VIEWS</div>
                <div className="detailStatValue">{album.views}</div>
              </div>
              <div>
                <div className="detailStatLabel">UNIQUE VISITORS</div>
                <div className="detailStatValue">{album.views}</div>
              </div>
              <div>
                <div className="detailStatLabel">PHOTOS VIEWED</div>
                <div className="detailStatValue">
                  {counts.bride + counts.groom + counts.both}
                </div>
              </div>
              <div>
                <div className="detailStatLabel">DOWNLOADS</div>
                <div className="detailStatValue">0</div>
              </div>
            </div>
          </div>

          <div className="panel detailCard">
            <h3 className="detailCardTitle">Enquiries (0)</h3>
            <p className="muted tiny">No enquiries yet.</p>
          </div>

          <div className="panel detailCard">
            <h3 className="detailCardTitle">Comments (0)</h3>
            <p className="muted tiny">No comments yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
