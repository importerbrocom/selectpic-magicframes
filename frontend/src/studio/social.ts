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

/** Sensible defaults so the client header shows icons before Settings are set. */
export const DEFAULT_SOCIAL: SocialLinks = {
  instagram: 'https://www.instagram.com/magicframes.co.in',
  whatsapp: 'https://wa.me/919539047575',
  facebook: 'https://www.facebook.com/magicframes.co.in',
  pinterest: 'https://pin.it/magicframes',
};

export function loadSocialLinks(): SocialLinks {
  try {
    const raw = localStorage.getItem(SOCIAL_KEY);
    if (!raw) return { ...DEFAULT_SOCIAL };
    return { ...DEFAULT_SOCIAL, ...(JSON.parse(raw) as Partial<SocialLinks>) };
  } catch {
    return { ...DEFAULT_SOCIAL };
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
}

export const SOCIAL_ICONS: SocialIcon[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'pinterest', label: 'Pinterest' },
];
