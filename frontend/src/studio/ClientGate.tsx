import { useEffect, useState, type FormEvent } from 'react';
import { BrandMark } from './BrandMark';
import { SocialIcons } from './SocialIcons';
import { useAlbumCover } from './useAlbumCover';
import type { Album } from './types';

interface ClientGateProps {
  album: Album;
  onUnlock: () => void;
}

export function ClientGate({ album, onUnlock }: ClientGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const cover = useAlbumCover(album);

  // Reset the field whenever the album being gated changes.
  useEffect(() => {
    setPassword('');
    setError('');
  }, [album.id]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Compare whitespace-trimmed so stray spaces from typing/pasting on either
    // side don't cause a false mismatch.
    if (password.trim() === (album.password ?? '').trim()) {
      setError('');
      onUnlock();
    } else {
      setError(
        'That password does not match this private album. Please try again.',
      );
    }
  }

  return (
    <section id="clientGate">
      <div
        className="gateBg"
        style={
          cover
            ? {
                backgroundImage: `linear-gradient(#071008a8,#071008b8), url('${cover}')`,
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
          <button className="gateEnter" type="submit">
            VIEW ALBUM
          </button>
          <div className="gateError">{error}</div>
        </form>
        <SocialIcons className="gateSocial" />
      </div>
    </section>
  );
}
