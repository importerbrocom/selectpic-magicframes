import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { initialAlbums } from './studio/data';
import type {
  Album,
  Screen,
  SelectionType,
  StaffMember,
} from './studio/types';
import { api, apiConfigured } from './studio/api';
import { useToast } from './studio/useToast';
import { LoginView } from './studio/LoginView';
import { AdminView } from './studio/AdminView';
import { ClientGate } from './studio/ClientGate';
import { ClientView } from './studio/ClientView';

const ADMIN_EMAIL = 'admin@magicframes.test';
const ADMIN_PASSWORD = 'password';
const STORAGE_KEY = 'magicframes.albums.v1';
const SEEDED_KEY = 'magicframes.albums.seeded.v1';
const STAFF_KEY = 'magicframes.staff.v1';
const USE_API = apiConfigured();

const seedStaff: StaffMember[] = [
  {
    id: 1,
    name: 'Studio Admin',
    email: 'admin@magicframes.test',
    tempPassword: 'password',
    status: 'active',
  },
];

function loadStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    if (!raw) return seedStaff;
    const stored = JSON.parse(raw) as StaffMember[];
    return Array.isArray(stored) && stored.length ? stored : seedStaff;
  } catch {
    return seedStaff;
  }
}

/** Local album store (fallback when the API isn't configured). */
function loadAlbums(): Album[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Album[];
      if (Array.isArray(stored)) return stored;
    }
    if (localStorage.getItem(SEEDED_KEY)) return [];
    localStorage.setItem(SEEDED_KEY, '1');
    return initialAlbums;
  } catch {
    return initialAlbums;
  }
}

/**
 * Parse a client share link from the URL. Supports the new slug path
 * (/a/<slug>) and the legacy id forms (#client-5, ?client=5).
 */
function parseClientLink(): { slug?: string; id?: number } {
  const pathMatch = location.pathname.match(/\/a\/([a-z0-9-]+)/i);
  if (pathMatch) return { slug: pathMatch[1] };
  const decoded = decodeURIComponent(location.href);
  const hashMatch = decoded.match(/#\/?client-(\d+)/);
  if (hashMatch) return { id: Number(hashMatch[1]) };
  const q = new URLSearchParams(location.search).get('client');
  if (q && /^\d+$/.test(q)) return { id: Number(q) };
  const qs = new URLSearchParams(location.search).get('a');
  if (qs) return { slug: qs };
  return {};
}

const hasClientLink = (() => {
  const l = parseClientLink();
  return l.slug !== undefined || l.id !== undefined;
})();

export default function App() {
  const [albums, setAlbums] = useState<Album[]>(() =>
    USE_API ? [] : loadAlbums(),
  );
  const [staff, setStaff] = useState<StaffMember[]>(loadStaff);

  // Start on the client gate directly if opened via a share link.
  const [screen, setScreen] = useState<Screen>(() =>
    hasClientLink ? 'clientGate' : 'login',
  );
  const [activeAlbumId, setActiveAlbumId] = useState<number>(
    () => parseClientLink().id ?? loadAlbums()[0]?.id ?? initialAlbums[0].id,
  );
  const [loading, setLoading] = useState<boolean>(hasClientLink || USE_API);
  const { message: toast, showToast } = useToast();

  // Persist to localStorage only in local (no-API) mode.
  useEffect(() => {
    if (USE_API) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
    } catch {
      /* ignore */
    }
  }, [albums]);

  useEffect(() => {
    try {
      localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    } catch {
      /* ignore */
    }
  }, [staff]);

  const activeAlbum =
    albums.find((a) => a.id === activeAlbumId) ?? null;

  const albumsRef = useRef(albums);
  albumsRef.current = albums;

  // Resolve the album for a client link and open its gate.
  const openClientLink = useCallback(async (link: { slug?: string; id?: number }) => {
    try {
      if (USE_API && link.slug) {
        const album = await api.getAlbumBySlug(link.slug);
        const selections = await api.getSelections(album.id).catch(() => ({}));
        const full = { ...album, selections };
        setAlbums((prev) => {
          const rest = prev.filter((a) => a.id !== full.id);
          return [full, ...rest];
        });
        setActiveAlbumId(full.id);
        setScreen('clientGate');
        return;
      }
      if (link.id !== undefined) {
        setActiveAlbumId(link.id);
        setScreen('clientGate');
      }
    } catch {
      showToast('This album link could not be opened.');
      setScreen('clientGate');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // On mount: load the client album (via link) or the admin album list.
  useEffect(() => {
    const link = parseClientLink();
    if (link.slug !== undefined || link.id !== undefined) {
      void openClientLink(link);
      return;
    }
    if (USE_API) {
      api
        .listAlbums()
        .then((list) => setAlbums(list))
        .catch(() => showToast('Could not reach the server; working offline.'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogin(email: string, password: string) {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setScreen('admin');
      showToast('Welcome to Magic Frames Studio');
    } else {
      showToast('Invalid demo credentials. Use admin@magicframes.test / password.');
    }
  }

  function openClientGate(id: number) {
    setActiveAlbumId(id);
    setScreen('clientGate');
  }

  function handleCreateAlbum(data: Omit<Album, 'id'>): number {
    const tempId = Math.max(0, ...albums.map((a) => a.id)) + 1;
    if (USE_API) {
      api
        .createAlbum(data)
        .then((created) => {
          setAlbums((prev) => [created, ...prev]);
          setActiveAlbumId(created.id);
        })
        .catch((e: Error) => showToast(e.message));
      return tempId;
    }
    const album: Album = { ...data, id: tempId };
    setAlbums((prev) => [album, ...prev]);
    setActiveAlbumId(tempId);
    return tempId;
  }

  function handleUpdateAlbum(id: number, patch: Partial<Album>) {
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    if (USE_API) {
      api.updateAlbum(id, patch).catch((e: Error) => showToast(e.message));
    }
  }

  function handleDeleteAlbum(id: number) {
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    if (USE_API) {
      api.deleteAlbum(id).catch((e: Error) => showToast(e.message));
    }
  }

  function handleAddStaff(data: Omit<StaffMember, 'id' | 'status'>): boolean {
    const email = data.email.trim().toLowerCase();
    if (staff.some((s) => s.email.toLowerCase() === email)) return false;
    const id = Math.max(0, ...staff.map((s) => s.id)) + 1;
    setStaff((prev) => [
      ...prev,
      {
        id,
        name: data.name.trim(),
        email: data.email.trim(),
        tempPassword: data.tempPassword,
        status: 'active',
      },
    ]);
    return true;
  }

  function handleUpdateStaff(id: number, patch: Partial<StaffMember>) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function handleDeleteStaff(id: number) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  function handleClientUnlock() {
    if (!activeAlbum) return;
    setScreen('client');
  }

  function handleMark(photoId: string, type: SelectionType) {
    if (!activeAlbum || activeAlbum.locked) return;
    const albumId = activeAlbum.id;
    let nextChoice: SelectionType | null = type;
    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id !== albumId) return a;
        const selections = { ...a.selections };
        if (selections[photoId] === type) {
          delete selections[photoId];
          nextChoice = null;
        } else {
          selections[photoId] = type;
        }
        return { ...a, selections };
      }),
    );
    if (USE_API) {
      // The backend toggles: calling with the same choice removes it. We always
      // send the clicked choice, which matches the toggle semantics.
      api.saveSelection(albumId, photoId, type).catch(() => {});
    }
    void nextChoice;
  }

  function handleSubmitSelections() {
    if (!activeAlbum) return;
    handleUpdateAlbum(activeAlbum.id, {
      locked: true,
      status: 'Selections submitted',
    });
    showToast('Final selections submitted and locked.');
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#090a08',
          color: '#c9c2b8',
          fontFamily: 'Montserrat, sans-serif',
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <>
      {screen === 'login' && (
        <LoginView onLogin={handleLogin} showToast={showToast} />
      )}

      {screen === 'admin' && (
        <AdminView
          albums={albums}
          staff={staff}
          onCreateAlbum={handleCreateAlbum}
          onUpdateAlbum={handleUpdateAlbum}
          onDeleteAlbum={handleDeleteAlbum}
          onAddStaff={handleAddStaff}
          onUpdateStaff={handleUpdateStaff}
          onDeleteStaff={handleDeleteStaff}
          onOpenClientGate={openClientGate}
          onLogout={() => setScreen('login')}
          showToast={showToast}
        />
      )}

      {screen === 'clientGate' &&
        (activeAlbum ? (
          <ClientGate album={activeAlbum} onUnlock={handleClientUnlock} />
        ) : (
          <div
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              background: '#090a08',
              color: '#c9c2b8',
              padding: 24,
              textAlign: 'center',
            }}
          >
            This album link is invalid or the album is no longer available.
          </div>
        ))}

      {screen === 'client' && activeAlbum && (
        <ClientView
          album={activeAlbum}
          onMark={handleMark}
          onSubmit={handleSubmitSelections}
          showToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
