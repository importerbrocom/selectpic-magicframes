import { useEffect, useState, type FormEvent } from 'react';

interface ProfileViewProps {
  showToast: (msg: string) => void;
}

interface Profile {
  name: string;
  email: string;
  /** Data-URL of the uploaded avatar, if any. */
  photo: string | null;
}

const PROFILE_KEY = 'magicframes.profile.v1';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB

const DEFAULT_PROFILE: Profile = {
  name: 'Studio Admin',
  email: 'admin@magicframes.test',
  photo: null,
};

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function ProfileView({ showToast }: ProfileViewProps) {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  const initial = (profile.name.trim()[0] || 'S').toUpperCase();

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfile((p) => ({ ...p, name: name.trim(), email: email.trim() }));
    showToast('Profile saved.');
  }

  function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast('Image is larger than 4MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfile((p) => ({ ...p, photo: String(reader.result) }));
      showToast('Profile photo updated.');
    };
    reader.readAsDataURL(file);
  }

  function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      showToast('New password must be at least 8 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('New password and confirmation do not match.');
      return;
    }
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    showToast('Password changed.');
  }

  return (
    <div className="profilePage">
      {/* Account */}
      <div className="panel profileCard">
        <h2 className="profileCardTitle">Account</h2>
        <div className="profileAccount">
          <div>
            <div className="detailStatLabel">ROLE</div>
            <div className="profileAccountValue">Admin</div>
          </div>
          <div>
            <div className="detailStatLabel">STATUS</div>
            <div className="profileAccountValue">Active</div>
          </div>
        </div>
      </div>

      {/* Profile Photo */}
      <div className="panel profileCard">
        <h2 className="profileCardTitle">Profile Photo</h2>
        <div className="profilePhotoRow">
          <div className="avatar">
            {profile.photo ? (
              <img src={profile.photo} alt="Profile" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <label className="btn outline uploadBtn">
            Upload photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </label>
        </div>
        <p className="muted tiny" style={{ marginTop: 14 }}>
          JPG, PNG or WebP. Max 4MB.
        </p>
      </div>

      {/* Edit Profile */}
      <div className="panel profileCard">
        <h2 className="profileCardTitle">Edit Profile</h2>
        <form onSubmit={saveProfile}>
          <div className="field">
            <label>Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn">
            Save changes
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="panel profileCard">
        <h2 className="profileCardTitle">Change Password</h2>
        <form onSubmit={changePassword}>
          <div className="field">
            <label>Current password</label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <label>New password (min 8 characters)</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" className="btn">
            Change password
          </button>
        </form>
      </div>
    </div>
  );
}
