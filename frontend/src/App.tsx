import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { initialAlbums } from './studio/data';
import type {
  Album,
  Screen,
  SelectionType,
  StaffMember,
} from './studio/types';
import { useToast } from './studio/useToast';
import { LoginView } from './studio/LoginView';
import { AdminView } from './studio/AdminView';
import { ClientGate } from './studio/ClientGate';
import { ClientView } from './studio/ClientView';

const ADMIN_EMAIL = 'admin@magicframes.test';
const ADMIN_PASSWORD = 'password';
const STORAGE_KEY = 'magicframes.albums.v1';
const STAFF_KEY = 'magicframes.staff.v1';

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

/**
 * Load albums from localStorage, falling back to the seed data. Any seed album
 * that isn't already stored is appended, so the built-in demo albums always
 * exist alongside ones the admin created.
 */
function loadAlbums(): Album[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialAlbums;
    const stored = JSON.parse(raw) as Album[];
    if (!Array.isArray(stored) || stored.length === 0) return initialAlbums;
    const ids = new Set(stored.map((a) => a.id));
    const missingSeeds = initialAlbums.filter((a) => !ids.has(a.id));
    return [...stored, ...missingSeeds];
  } catch {
    return initialAlbums;
  }
}

export default function App() {
  const [albums, setAlbums] = useState<Album[]>(loadAlbums);
  const [staff, setStaff] = useState<StaffMember[]>(loadStaff);
  const [screen, setScreen] = useState<Screen>('login');
  const [activeAlbumId, setActiveAlbumId] = useState<number>(
    () => loadAlbums()[0]?.id ?? initialAlbums[0].id,
  );
  const { message: toast, showToast } = useToast();

  // Persist albums (passwords, selections, lock state) so created albums and
  // client selections survive reloads and direct #client-<id> links.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
    } catch {
      // Storage may be unavailable (private mode / quota); ignore.
    }
  }, [albums]);

  useEffect(() => {
    try {
      localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    } catch {
      // ignore
    }
  }, [staff]);

  const activeAlbum =
    albums.find((a) => a.id === activeAlbumId) ?? albums[0] ?? null;

  // Keep the latest albums in a ref so the hash handler can read them without
  // being a dependency (otherwise unrelated album updates — e.g. bumping the
  // view count on unlock — would re-run the effect and bounce the user back
  // to the gate).
  const albumsRef = useRef(albums);
  albumsRef.current = albums;

  const openClientGate = useCallback((id: number) => {
    setActiveAlbumId(id);
    setScreen('clientGate');
    if (location.hash !== '#client-' + id) {
      history.replaceState(null, '', '#client-' + id);
    }
  }, []);

  // Deep-link support: #client-<id> jumps to that album's gate. Runs once on
  // mount and only in response to real hashchange events.
  useEffect(() => {
    function fromHash() {
      const match = location.hash.match(/^#client-(\d+)$/);
      if (match) {
        const id = Number(match[1]);
        if (albumsRef.current.some((a) => a.id === id)) openClientGate(id);
      }
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [openClientGate]);

  function handleLogin(email: string, password: string) {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setScreen('admin');
      showToast('Welcome to Magic Frames Studio');
    } else {
      showToast('Invalid demo credentials. Use admin@magicframes.test / password.');
    }
  }

  function handleCreateAlbum(data: Omit<Album, 'id'>): number {
    const id = Math.max(0, ...albums.map((a) => a.id)) + 1;
    const album: Album = { ...data, id };
    setAlbums((prev) => [album, ...prev]);
    setActiveAlbumId(id);
    return id;
  }

  function handleUpdateAlbum(id: number, patch: Partial<Album>) {
    setAlbums((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }

  function handleDeleteAlbum(id: number) {
    setAlbums((prev) => prev.filter((a) => a.id !== id));
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
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === activeAlbum.id ? { ...a, views: a.views + 1 } : a,
      ),
    );
    setScreen('client');
  }

  function handleMark(photoId: string, type: SelectionType) {
    if (!activeAlbum || activeAlbum.locked) return;
    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id !== activeAlbum.id) return a;
        const selections = { ...a.selections };
        if (selections[photoId] === type) delete selections[photoId];
        else selections[photoId] = type;
        return { ...a, selections };
      }),
    );
  }

  function handleSubmitSelections() {
    if (!activeAlbum) return;
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === activeAlbum.id
          ? { ...a, locked: true, status: 'Completed' }
          : a,
      ),
    );
    showToast('Final selections submitted and locked.');
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

      {screen === 'clientGate' && activeAlbum && (
        <ClientGate album={activeAlbum} onUnlock={handleClientUnlock} />
      )}

      {screen === 'client' && activeAlbum && (
        <ClientView
          album={activeAlbum}
          onMark={handleMark}
          onSubmit={handleSubmitSelections}
          onExit={() => setScreen('clientGate')}
          showToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
