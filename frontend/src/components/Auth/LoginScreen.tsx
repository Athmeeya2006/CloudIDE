import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

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
    <div className="h-screen w-screen flex items-center justify-center bg-ide-bg text-ide-text">
      <div className="w-[340px]">
        <div className="flex items-center gap-2 mb-6">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="4" fill="#007acc" />
            <path d="M8 10l8 6-8 6V10z" fill="white" />
            <rect x="18" y="20" width="8" height="2" rx="1" fill="white" />
          </svg>
          <span className="text-[14px] font-medium">Cloud IDE</span>
        </div>

        <div className="flex border-b border-ide-border mb-5">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                'px-3 py-2 text-[13px] -mb-px border-b-2 transition-colors ' +
                (mode === m
                  ? 'border-ide-accent text-ide-text'
                  : 'border-transparent text-ide-text-muted hover:text-ide-text')
              }
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-ide-text-muted">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-ide-bg border border-ide-border rounded px-3 py-2 text-[13px] text-ide-text outline-none focus:border-ide-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-ide-text-muted">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-ide-bg border border-ide-border rounded px-3 py-2 text-[13px] text-ide-text outline-none focus:border-ide-accent"
            />
          </div>

          {error && <div className="text-[12px] text-ide-red">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="bg-ide-accent hover:bg-[#1a8ad4] disabled:opacity-50 text-white rounded px-3 py-2 text-[13px] font-medium flex items-center justify-center gap-2 mt-1"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
