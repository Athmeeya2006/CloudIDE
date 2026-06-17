import { useState, useRef, useEffect } from 'react';
import { RefreshCw, ExternalLink, X, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useProcessStore } from '../../stores/processStore';
import { rawFileUrl, previewProxyUrl, portFromProxyUrl, previewApi } from '../../api/client';

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
  const [waiting, setWaiting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const runningProcess = processes.find(p => p.status === 'running');
  // Previews go through the backend proxy (previewProxyUrl) so they work even
  // when the IDE backend runs on a different machine than the browser.
  const activeUrl = previewUrl || (runningProcess ? previewProxyUrl(5173) : '');

  // When the preview points at a proxied port, wait for that dev server to come
  // up (npm install + bundler boot can take a while) before loading the iframe,
  // instead of flashing a connection error. Polls until it is listening.
  useEffect(() => {
    setError(false);
    const port = activeUrl ? portFromProxyUrl(activeUrl) : null;
    if (!activeUrl || port === null) { setWaiting(false); return; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = Date.now();
    setWaiting(true);

    const poll = async () => {
      if (cancelled) return;
      try {
        const { listening } = await previewApi.status(port);
        if (cancelled) return;
        if (listening) { setWaiting(false); return; }
      } catch { /* keep trying */ }
      if (Date.now() - start > 120000) { setWaiting(false); setError(true); return; }
      timer = setTimeout(poll, 1500);
    };
    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [activeUrl, reloadKey]);

  const reload = () => {
    setError(false);
    // Remount the iframe; re-assigning the same src is unreliable cross-origin.
    setReloadKey(k => k + 1);
  };

  const previewPort = activeUrl ? portFromProxyUrl(activeUrl) : null;

  const navigate = (url: string) => {
    setError(false);
    const v = url.trim();
    // A bare port, ":port", or localhost:port routes through the backend proxy.
    const portMatch = v.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)?:?(\d{2,5})\/?$/i);
    if (portMatch) {
      setPreviewUrl(previewProxyUrl(Number(portMatch[1])));
      return;
    }
    // An existing proxy/api path or a full external URL is used as-is.
    if (/^https?:\/\//i.test(v) || v.startsWith('/')) {
      setPreviewUrl(v);
      return;
    }
    // Otherwise treat it as a workspace path served as a static file.
    if (v) setPreviewUrl(rawFileUrl(v));
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
            placeholder="5173  or  index.html"
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
          const url = previewProxyUrl(port);
          const isActive = activeUrl === url;
          return (
            <button
              key={port}
              onClick={() => navigate(String(port))}
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
        ) : waiting ? (
          <Starting port={previewPort} onOpenAnyway={() => setWaiting(false)} />
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
            onClick={() => onOpen(String(port))}
            className="text-[12px] py-1.5 border border-ide-border hover:border-ide-accent text-ide-text transition-colors"
          >
            Open port {port}
          </button>
        ))}
      </div>
    </div>
  );
}

function Starting({ port, onOpenAnyway }: { port: number | null; onOpenAnyway: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-ide-text-muted gap-4 bg-ide-bg">
      <Loader2 size={34} className="animate-spin text-ide-accent" />
      <div className="text-center">
        <div className="text-[14px] text-ide-text mb-1">
          Starting your app{port ? ` on port ${port}` : ''}…
        </div>
        <div className="text-[12px] max-w-[260px]">
          The first run can take up to a minute while dependencies install and the
          dev server boots. This will load automatically.
        </div>
      </div>
      <button
        onClick={onOpenAnyway}
        className="text-[12px] px-3 py-1.5 border border-ide-border hover:border-ide-accent text-ide-text transition-colors"
      >
        Open now
      </button>
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
