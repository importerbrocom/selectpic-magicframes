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

export default function App() {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [screen, setScreen] = useState<Screen>('login');
  const [activeAlbumId, setActiveAlbumId] = useState<number>(initialAlbums[0].id);
  const { message: toast, showToast } = useToast();

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
