import { useState, type FormEvent } from 'react';
import {
  loadSocialLinks,
  saveSocialLinks,
  type SocialLinks,
} from './social';

interface SettingsViewProps {
  /** Admin display name + email for the Account card. */
  adminName: string;
  adminEmail: string;
  onEditProfile: () => void;
  onManageStaff: () => void;
  showToast: (msg: string) => void;
}

const FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] =
  [
    {
      key: 'instagram',
      label: 'Instagram URL',
      placeholder: 'https://www.instagram.com/yourstudio',
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp URL',
      placeholder: 'https://wa.me/919539047575',
    },
    {
      key: 'facebook',
      label: 'Facebook URL',
      placeholder: 'https://www.facebook.com/yourstudio',
    },
    {
      key: 'pinterest',
      label: 'Pinterest URL',
      placeholder: 'https://pin.it/yourstudio',
    },
  ];

export function SettingsView({
  adminName,
  adminEmail,
  onEditProfile,
  onManageStaff,
  showToast,
}: SettingsViewProps) {
  const [links, setLinks] = useState<SocialLinks>(loadSocialLinks);

  function update(key: keyof SocialLinks, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value }));
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const trimmed: SocialLinks = {
      instagram: links.instagram.trim(),
      whatsapp: links.whatsapp.trim(),
      facebook: links.facebook.trim(),
      pinterest: links.pinterest.trim(),
    };
    saveSocialLinks(trimmed);
    setLinks(trimmed);
    showToast('Social links saved.');
  }

  return (
    <div className="settingsPage">
      {/* Account */}
      <div className="panel profileCard">
        <h2 className="profileCardTitle">Account</h2>
        <div className="profileAccount settingsAccount">
          <div>
            <div className="detailStatLabel">NAME</div>
            <div className="profileAccountValue">{adminName}</div>
          </div>
          <div>
            <div className="detailStatLabel">EMAIL</div>
            <div className="profileAccountValue">{adminEmail}</div>
          </div>
          <div>
            <div className="detailStatLabel">ROLE</div>
            <div className="profileAccountValue">Admin</div>
          </div>
          <div>
            <div className="detailStatLabel">STATUS</div>
            <div className="profileAccountValue">Active</div>
          </div>
        </div>
        <div className="detailActions" style={{ marginTop: 20 }}>
          <button className="btn outline" onClick={onEditProfile}>
            Edit profile &amp; password
          </button>
          <button className="btn outline" onClick={onManageStaff}>
            Manage staff
          </button>
        </div>
      </div>

      {/* Social Media Links */}
      <div className="panel profileCard">
        <h2 className="profileCardTitle">Social Media Links</h2>
        <p className="muted tiny" style={{ marginTop: -8, marginBottom: 16 }}>
          These icons appear on every album. A single album can still override a
          link from its own Edit page. Only filled links are shown.
        </p>
        <form onSubmit={save}>
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input
                type="url"
                placeholder={f.placeholder}
                value={links[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            </div>
          ))}
          <button type="submit" className="btn">
            Save social links
          </button>
        </form>
      </div>
    </div>
  );
}
