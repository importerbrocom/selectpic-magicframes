import { loadSocialLinks, SOCIAL_ICONS } from './social';

interface SocialIconsProps {
  /** Extra class for the wrapper (e.g. "gateSocial"). */
  className?: string;
}

/**
 * Renders the studio's social icons as links, showing only the ones that
 * have a URL configured in Settings. Renders nothing if none are set.
 */
export function SocialIcons({ className = '' }: SocialIconsProps) {
  const links = loadSocialLinks();
  const active = SOCIAL_ICONS.filter((icon) => links[icon.key].trim());

  if (active.length === 0) return null;

  return (
    <div className={'socials ' + className}>
      {active.map((icon) => (
        <a
          key={icon.key}
          className="social"
          href={links[icon.key].trim()}
          title={icon.label}
          target="_blank"
          rel="noopener noreferrer"
        >
          {icon.glyph}
        </a>
      ))}
    </div>
  );
}
