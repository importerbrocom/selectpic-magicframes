import { useEffect, useState, type FormEvent } from 'react';
import { BrandMark } from './BrandMark';
import { SocialIcons } from './SocialIcons';
import { useAlbumCover } from './useAlbumCover';
import type { Album } from './types';

interface ClientGateProps {
  album: Album;
  /** Resolves to an error message, or null when unlocked. */
  onUnlock: (password: string) => Promise<string | null>;
}

export function ClientGate({ album, onUnlock }: ClientGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cover = useAlbumCover(album);

  // Reset the field whenever the album being gated changes.
  useEffect(() => {
    setPassword('');
    setError('');
  }, [album.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const err = await onUnlock(password.trim());
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <section id="clientGate">
      <div
        className="gateBg"
        style={
          cover
            ? {
                backgroundImage: `linear-gradient(#0710084d,#07100866), url('${cover}')`,
              }
            : undefined
        }
      />
      <div className="gateInner">
        <BrandMark src="/logotrans.png" imgClassName="gateLogo" />
        <div className="eyebrow">A STORY IN EVERY FRAME</div>
        <h1 className="script">{album.name}</h1>
        <div className="subtitle">{album.subtitle}</div>
        <div
          style={{
            width: 70,
            height: 1,
            background: 'var(--gold)',
            margin: '20px auto 26px',
          }}
        />
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter Album Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="gateEnter" type="submit" disabled={busy}>
            {busy ? 'CHECKING…' : 'VIEW ALBUM'}
          </button>
          <div className="gateError">{error}</div>
        </form>
        <SocialIcons className="gateSocial" />
      </div>
    </section>
  );
}
