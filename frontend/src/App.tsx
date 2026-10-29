import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { initialAlbums } from './studio/data';
import type { Album, Screen, SelectionType } from './studio/types';
import { useToast } from './studio/useToast';
import { LoginView } from './studio/LoginView';
import { AdminView } from './studio/AdminView';
import { ClientGate } from './studio/ClientGate';
import { ClientView } from './studio/ClientView';

const ADMIN_EMAIL = 'admin@magicframes.test';
const ADMIN_PASSWORD = 'password';
const STORAGE_KEY = 'magicframes.albums.v1';

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

  const activeAlbum =
    albums.find((a) => a.id === activeAlbumId) ?? albums[0] ?? null;

  const openClientGate = useCallback((id: number) => {
    setActiveAlbumId(id);
    setScreen('clientGate');
    if (location.hash !== '#client-' + id) {
      history.replaceState(null, '', '#client-' + id);
    }
  }, []);

  // Deep-link support: #client-<id> jumps straight to that album's gate.
  useEffect(() => {
    function fromHash() {
      const match = location.hash.match(/^#client-(\d+)$/);
      if (match) {
        const id = Number(match[1]);
        if (albums.some((a) => a.id === id)) openClientGate(id);
      }
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [albums, openClientGate]);

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
          onCreateAlbum={handleCreateAlbum}
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
