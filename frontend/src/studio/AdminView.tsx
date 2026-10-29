import { useMemo, useState, type FormEvent } from 'react';
import { BrandMark } from './BrandMark';
import { downloadAlbumCSV, selectionCounts } from './helpers';
import { photos } from './data';
import type { Album, AdminTab, SelectionType } from './types';

interface AdminViewProps {
  albums: Album[];
  onCreateAlbum: (album: Omit<Album, 'id'>) => number;
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
  onOpenClientGate,
  onLogout,
  showToast,
}: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [search, setSearch] = useState('');
  const [manageId, setManageId] = useState<number | null>(null);

  // Create form state.
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEvents, setNewEvents] = useState(
    'Haldi, Engagement, Wedding, Reception',
  );
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

  const manageAlbum = albums.find((a) => a.id === manageId) ?? null;

  function openCreate() {
    setTab('create');
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    const events = newEvents
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    onCreateAlbum({
      name,
      subtitle: newSubtitle.trim() || 'A Story in Every Frame',
      password: newPassword,
      events: events.length ? events : ['Wedding'],
      photos: photos.length,
      cover: newCover.trim() || photos[0].url,
      status: 'In progress',
      views: 0,
      locked: false,
      selections: {},
    });
    setNewName('');
    setNewSubtitle('');
    setNewPassword('');
    setNewCover('');
    setNewEvents('Haldi, Engagement, Wedding, Reception');
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
    <section id="adminView">
      <aside className="sidebar">
        <div className="sideLogo">
          <BrandMark />
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.tab}
              className={tab === item.tab ? 'active' : ''}
              onClick={() => setTab(item.tab)}
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
          <h1>{titleFor(tab)}</h1>
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
              <article className="panel albumCard" key={a.id}>
                <img src={a.cover} alt="" />
                <div className="albumInfo">
                  <h3>{a.name}</h3>
                  <p>{a.subtitle}</p>
                  <div className="albumMeta">
                    {a.photos.toLocaleString()} photos · {a.events.length} events ·{' '}
                    {a.status}
                  </div>
                  <div className="cardActions">
                    <button
                      className="btn small"
                      onClick={() => onOpenClientGate(a.id)}
                    >
                      Client portal ↗
                    </button>
                    <button
                      className="btn small outline"
                      onClick={() => exportCSV(a, 'all')}
                    >
                      Export CSV
                    </button>
                    <button
                      className="btn small outline"
                      onClick={() => setManageId(a.id)}
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Albums */}
        <div className={'adminContent' + (tab === 'albums' ? ' active' : '')}>
          <div className="toolbar">
            <input
              placeholder="Search albums…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '11px 13px',
                border: '1px solid #ddd',
                borderRadius: 7,
                minWidth: 220,
              }}
            />
            <button className="btn goldbtn" onClick={openCreate}>
              ＋ Create album
            </button>
          </div>
          <div className="tableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>CLIENT / ALBUM</th>
                  <th>PHOTOS</th>
                  <th>EVENTS</th>
                  <th>BRIDE</th>
                  <th>GROOM</th>
                  <th>BOTH</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlbums.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      No albums found.
                    </td>
                  </tr>
                ) : (
                  filteredAlbums.map((a) => {
                    const c = selectionCounts(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <b>{a.name}</b>
                          <br />
                          <span className="muted">{a.subtitle}</span>
                        </td>
                        <td>{a.photos.toLocaleString()}</td>
                        <td>{a.events.length}</td>
                        <td>{c.bride}</td>
                        <td>{c.groom}</td>
                        <td>{c.both}</td>
                        <td>
                          <span className={'status ' + (a.locked ? '' : 'pending')}>
                            {a.locked ? 'Locked' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn small"
                            onClick={() => onOpenClientGate(a.id)}
                          >
                            Open
                          </button>{' '}
                          <button
                            className="btn small outline"
                            onClick={() => setManageId(a.id)}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create */}
        <div className={'adminContent' + (tab === 'create' ? ' active' : '')}>
          <div className="panel" style={{ padding: 25, maxWidth: 750 }}>
            <h2 className="sectionTitle">Create a client album</h2>
            <p className="muted">
              Create a private client portal with its own password and unique link.
            </p>
            <form onSubmit={handleCreate}>
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
              <div className="field">
                <label>Events / folders</label>
                <input
                  value={newEvents}
                  onChange={(e) => setNewEvents(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Cover image URL (optional)</label>
                <input
                  placeholder="https://…"
                  value={newCover}
                  onChange={(e) => setNewCover(e.target.value)}
                />
              </div>
              <button className="btn goldbtn">Create private album</button>
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

      {manageAlbum && (
        <ManageModal
          album={manageAlbum}
          onClose={() => setManageId(null)}
          onCopyLink={copyPrivateLink}
          onExport={exportCSV}
          onPreview={(id) => {
            setManageId(null);
            onOpenClientGate(id);
          }}
        />
      )}
    </section>
  );
}

interface ManageModalProps {
  album: Album;
  onClose: () => void;
  onCopyLink: (link: string) => void;
  onExport: (album: Album, type: 'all' | SelectionType) => void;
  onPreview: (id: number) => void;
}

function ManageModal({
  album,
  onClose,
  onCopyLink,
  onExport,
  onPreview,
}: ManageModalProps) {
  const link = `${location.href.split('#')[0]}#client-${album.id}`;
  return (
    <div
      className="modalBack"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modalHead">
          <h2>Manage client album</h2>
          <button className="closeBtn" onClick={onClose}>
            ×
          </button>
        </div>
        <p>
          <b>{album.name}</b>
        </p>
        <p className="muted tiny">Private client link</p>
        <input
          readOnly
          value={link}
          style={{
            width: '100%',
            padding: 11,
            border: '1px solid #ddd',
            borderRadius: 6,
          }}
        />
        <div className="cardActions">
          <button className="btn small" onClick={() => onCopyLink(link)}>
            Copy private link
          </button>
          <button
            className="btn small outline"
            onClick={() => onExport(album, 'bride')}
          >
            Download Bride CSV
          </button>
          <button
            className="btn small outline"
            onClick={() => onExport(album, 'groom')}
          >
            Download Groom CSV
          </button>
          <button
            className="btn small outline"
            onClick={() => onExport(album, 'both')}
          >
            Download Both CSV
          </button>
        </div>
        <div className="field">
          <label>Client password</label>
          <input readOnly value={album.password} />
        </div>
        <div className="field">
          <label>Album status</label>
          <div>
            {album.locked
              ? 'Locked after final submission'
              : 'Open for selections'}
          </div>
        </div>
        <button className="btn outline" onClick={() => onPreview(album.id)}>
          Preview client portal
        </button>
      </div>
    </div>
  );
}
