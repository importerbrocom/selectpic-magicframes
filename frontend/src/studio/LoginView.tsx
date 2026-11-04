import { useState, type FormEvent } from 'react';
import { BrandMark } from './BrandMark';

interface LoginViewProps {
  onLogin: (email: string, password: string) => void;
  showToast: (msg: string) => void;
}

const ADMIN_EMAIL = 'admin@magicframes.test';

export function LoginView({ onLogin, showToast }: LoginViewProps) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onLogin(email.trim(), password);
  }

  return (
    <section id="loginView">
      <div className="loginBrand">
        <BrandMark src="/logotrans.png" imgClassName="loginLogo" />
        <div className="brandUrl">MAGICFRAMES.CO.IN</div>
      </div>
      <div className="loginFormWrap">
        <form className="loginForm" onSubmit={handleSubmit}>
          <h1>Welcome back</h1>
          <p className="sub">Sign in to your account to continue</p>
          <div className="field">
            <label>
              Email <span style={{ color: '#d44' }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>
              Password <span style={{ color: '#d44' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                className="eye"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: 'absolute', right: 12, top: 13 }}
              >
                ◉
              </button>
            </div>
          </div>
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{' '}
            Remember me
          </label>
          <div className="loginActions">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                showToast(
                  'Password reset is a demo feature. Configure email delivery in production.',
                );
              }}
            >
              Forgot your password?
            </a>
            <button className="btn" type="submit" style={{ padding: '16px 34px' }}>
              LOG IN
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              color: '#9aa0ad',
              marginTop: 32,
            }}
          >
            <span style={{ height: 1, background: '#ddd', flex: 1 }} />
            or continue with
            <span style={{ height: 1, background: '#ddd', flex: 1 }} />
          </div>
          <button
            className="googleBtn"
            type="button"
            onClick={() => showToast('Google sign-in needs OAuth configuration.')}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <div className="demo">Demo: admin@magicframes.test / password</div>
        </form>
      </div>
    </section>
  );
}

/** Official multi-color Google "G" logo. */
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.98 21.98 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
