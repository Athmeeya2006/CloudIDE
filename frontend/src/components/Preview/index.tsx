import { useState, useRef } from 'react';
import { RefreshCw, ExternalLink, X, Globe, AlertCircle } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useProcessStore } from '../../stores/processStore';
import { rawFileUrl } from '../../api/client';

// Ports a user's app might serve on. 8000 is intentionally excluded: it is the
// IDE's own backend API and cannot be reused by user apps.
const DEFAULT_PORTS = [5173, 5000, 8080, 5001];
const PORT_LABELS: Record<number, string> = {
  5173: 'Vite/React',
  5000: 'Flask/FastAPI',
  8080: 'Web server',
  5001: 'App',
};

export function PreviewPanel() {
  const { previewUrl, setPreviewUrl, togglePreview } = useUIStore();
  const { processes } = useProcessStore();
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const runningProcess = processes.find(p => p.status === 'running');
  // The address bar always shows the exact host being previewed; the port
  // buttons switch it. Default to :5173 (common dev port), never 8000 (the IDE).
  const activeUrl = previewUrl || (runningProcess ? `http://localhost:5173` : '');

  const reload = () => {
    setError(false);
    // Remount the iframe; re-assigning the same src is unreliable cross-origin.
    setReloadKey(k => k + 1);
  };

  const navigate = (url: string) => {
    setError(false);
    const v = url.trim();
    // A workspace path (e.g. "default/index.html") is served as a static file;
    // anything starting with http(s):// or "/" is used as-is (a running server).
    if (v && !/^https?:\/\//i.test(v) && !v.startsWith('/')) {
      setPreviewUrl(rawFileUrl(v));
    } else {
      setPreviewUrl(v);
    }
  };

  const openExternal = () => {
    if (activeUrl) window.open(activeUrl, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-ide-bg border-l border-ide-border overflow-hidden">
      {/* Preview toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#252526] border-b border-ide-border shrink-0">
        <Globe size={13} className="text-ide-text-muted shrink-0" />

        <div className="flex items-center flex-1 bg-ide-bg border border-ide-border px-2 py-0.5 gap-1">
          <input
            value={customUrl || activeUrl}
            onChange={e => setCustomUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate(customUrl || activeUrl)}
            placeholder="localhost:5000  or  default/index.html"
            className="flex-1 bg-transparent text-ide-text text-[12px] outline-none placeholder:text-ide-text-dim"
          />
        </div>

        <button onClick={reload} title="Reload" className="p-1 text-ide-text-muted hover:text-ide-text">
          <RefreshCw size={13} />
        </button>
        <button onClick={openExternal} title="Open in new tab" className="p-1 text-ide-text-muted hover:text-ide-text">
          <ExternalLink size={13} />
        </button>
        <button onClick={togglePreview} title="Close Preview" className="p-1 text-ide-text-muted hover:text-ide-text">
          <X size={13} />
        </button>
      </div>

      {/* Quick port links */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#1e1e1e] border-b border-ide-border overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {DEFAULT_PORTS.map(port => {
          const url = `http://localhost:${port}`;
          const isActive = activeUrl === url;
          return (
            <button
              key={port}
              onClick={() => navigate(url)}
              title={PORT_LABELS[port]}
              className={`text-[11px] px-2 py-0.5 rounded shrink-0 transition-colors ${
                isActive ? 'bg-ide-accent text-white' : 'text-ide-text-dim hover:text-ide-text hover:bg-ide-hover'
              }`}
            >
              :{port}
            </button>
          );
        })}
      </div>

      {/* iframe / placeholder */}
      <div className="flex-1 overflow-hidden relative">
        {!activeUrl ? (
          <NoPreview onOpen={navigate} />
        ) : error ? (
          <PreviewError url={activeUrl} onRetry={reload} />
        ) : (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={activeUrl}
            title="App Preview"
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  );
}

function NoPreview({ onOpen }: { onOpen: (url: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-ide-text-muted gap-4">
      <Globe size={40} className="opacity-20" />
      <div className="text-center">
        <div className="text-[14px] text-ide-text mb-1">No app running</div>
        <div className="text-[12px]">Start your server first, then preview it here</div>
      </div>
      <div className="flex flex-col gap-1.5 w-48">
        {[5173, 5000, 8080].map(port => (
          <button
            key={port}
            onClick={() => onOpen(`http://localhost:${port}`)}
            className="text-[12px] py-1.5 border border-ide-border hover:border-ide-accent text-ide-text transition-colors"
          >
            Open localhost:{port}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewError({ url, onRetry }: { url: string; onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-ide-text-muted gap-3">
      <AlertCircle size={36} className="text-ide-red opacity-60" />
      <div className="text-center">
        <div className="text-[13px] text-ide-text mb-1">Cannot reach {url}</div>
        <div className="text-[12px]">Make sure your server is running</div>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 px-3 py-1.5 border border-ide-border hover:border-ide-accent text-ide-text text-[12px] transition-colors"
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}
