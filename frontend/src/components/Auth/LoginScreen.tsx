import { useState } from 'react';
import { Loader2, Terminal, Database, GitBranch, Play, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const FEATURES = [
  { icon: Terminal, label: 'Interactive terminal and one-key run' },
  { icon: Database, label: 'SQLite, Postgres, MySQL and MongoDB' },
  { icon: Play, label: 'Live preview with instant reload' },
  { icon: GitBranch, label: 'Built-in Git: clone, commit, push' },
];

export function LoginScreen() {
  const { login, register, loading, error } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password);
    } catch { /* error surfaced via store */ }
  };

  return (
    <div className="auth-scene h-screen w-screen flex items-center justify-center text-ide-text">
      <div className="auth-grid" />

      <div className="card-rise glass-card relative z-10 w-[860px] max-w-[94vw] rounded-2xl overflow-hidden grid md:grid-cols-2">
        {/* Brand / pitch panel */}
        <div className="hidden md:flex flex-col justify-between p-9 bg-gradient-to-br from-[#0c1830]/70 to-transparent border-r border-white/5">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[17px] font-semibold tracking-tight brand-gradient">Cloud IDE</span>
          </div>

          <div className="py-8">
            <h1 className="text-[26px] leading-tight font-semibold text-white">
              Code, run and ship<br />from your browser.
            </h1>
            <p className="text-[13px] text-ide-text-muted mt-3 leading-relaxed">
              A full development environment with an editor, terminal, databases
              and live preview. No setup required.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[12.5px] text-ide-text">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-ide-accent shrink-0">
                  <Icon size={14} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Form panel */}
        <div className="p-9 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2.5 mb-6">
            <Logo />
            <span className="text-[16px] font-semibold brand-gradient">Cloud IDE</span>
          </div>

          <h2 className="text-[20px] font-semibold text-white">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-[12.5px] text-ide-text-muted mt-1 mb-6">
            {mode === 'login'
              ? 'Sign in to open your projects.'
              : 'Start building in seconds, no credit card needed.'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="text-[12px] text-ide-text-muted flex flex-col gap-1.5">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input rounded-lg px-3.5 py-2.5 text-[13px] text-ide-text outline-none"
              />
            </label>

            <label className="text-[12px] text-ide-text-muted flex flex-col gap-1.5">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="auth-input rounded-lg px-3.5 py-2.5 text-[13px] text-ide-text outline-none"
              />
            </label>

            {error && (
              <div className="text-[12px] text-ide-red bg-ide-red/10 border border-ide-red/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient text-white rounded-lg px-4 py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <Loader2 size={15} className="animate-spin" />
                : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></>}
            </button>
          </form>

          <div className="text-[12px] text-ide-text-muted mt-6 text-center">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-ide-accent hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a84ff] to-[#2b6fff] shadow-lg shadow-blue-500/30">
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
        <path d="M8 10l8 6-8 6V10z" fill="white" />
        <rect x="18" y="20" width="8" height="2.4" rx="1.2" fill="white" />
      </svg>
    </span>
  );
}
