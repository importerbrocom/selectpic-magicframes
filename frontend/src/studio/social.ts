// Shared studio-wide social media links. Saved in Settings, read by the
// client-facing album pages so the icons point to real profiles.

export interface SocialLinks {
  instagram: string;
  whatsapp: string;
  facebook: string;
  pinterest: string;
}

export const SOCIAL_KEY = 'magicframes.social.v1';

export const EMPTY_SOCIAL: SocialLinks = {
  instagram: '',
  whatsapp: '',
  facebook: '',
  pinterest: '',
};

export function loadSocialLinks(): SocialLinks {
  try {
    const raw = localStorage.getItem(SOCIAL_KEY);
    if (!raw) return EMPTY_SOCIAL;
    return { ...EMPTY_SOCIAL, ...(JSON.parse(raw) as Partial<SocialLinks>) };
  } catch {
    return EMPTY_SOCIAL;
  }
}

export function saveSocialLinks(links: SocialLinks): void {
  try {
    localStorage.setItem(SOCIAL_KEY, JSON.stringify(links));
  } catch {
    // ignore
  }
}

export interface SocialIcon {
  key: keyof SocialLinks;
  label: string;
  glyph: string;
}

/** Icon glyphs matching the existing theme buttons. */
export const SOCIAL_ICONS: SocialIcon[] = [
  { key: 'instagram', label: 'Instagram', glyph: '◎' },
  { key: 'whatsapp', label: 'WhatsApp', glyph: '◉' },
  { key: 'facebook', label: 'Facebook', glyph: 'f' },
  { key: 'pinterest', label: 'Pinterest', glyph: '℗' },
];
