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
        <BrandMark />
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
            <b style={{ color: '#4285f4', fontSize: 20, marginRight: 10 }}>G</b>{' '}
            Continue with Google
          </button>
          <div className="demo">Demo: admin@magicframes.test / password</div>
        </form>
      </div>
    </section>
  );
}
