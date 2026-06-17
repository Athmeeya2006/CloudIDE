import { useEffect, useRef, useState } from 'react';
import { Play, ChevronDown, Loader2, Server } from 'lucide-react';
import { projectApi } from '../api/client';
import { useProjectStore } from '../stores/projectStore';
import { useProcessStore } from '../stores/processStore';
import { useUIStore } from '../stores/uiStore';
import { RunService } from '../types';
import { getErrorMessage } from '../utils';

/**
 * One-click launcher for a project's dev servers. Reads the services from the
 * backend (a `cloudide.json` if present, otherwise auto-detected), starts each
 * as a managed process, opens the Processes panel, and points the Preview at
 * the first service that exposes a port.
 */
export function RunDevButton() {
  const project = useProjectStore(s => s.current);
  const runCommand = useProcessStore(s => s.runCommand);
  const { openBottom, openPreview, notify } = useUIStore();

  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<RunService[]>([]);
  const [source, setSource] = useState<'config' | 'detected' | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchServices = async (): Promise<RunService[]> => {
    if (!project) return [];
    setLoading(true);
    try {
      const data = await projectApi.services(project.id);
      setServices(data.services);
      setSource(data.source);
      return data.services as RunService[];
    } catch (e) {
      notify(getErrorMessage(e, 'Could not load services'), 'error');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const startOne = async (svc: RunService) => {
    try {
      await runCommand(svc.command, svc.run_cwd, svc.name);
      openBottom('logs');
      if (svc.port) openPreview(`http://localhost:${svc.port}`);
      notify(`Started ${svc.name}`, 'success');
    } catch (e) {
      notify(getErrorMessage(e, `Failed to start ${svc.name}`), 'error');
    }
  };

  const startAll = async () => {
    setBusy(true);
    try {
      const list = services.length ? services : await fetchServices();
      if (list.length === 0) {
        notify('No runnable services found. Add a cloudide.json to define them.', 'error');
        setOpen(true);
        return;
      }
      let previewPort: number | null = null;
      for (const svc of list) {
        await runCommand(svc.command, svc.run_cwd, svc.name);
        if (!previewPort && svc.port) previewPort = svc.port;
      }
      openBottom('logs');
      if (previewPort) openPreview(`http://localhost:${previewPort}`);
      notify(`Started ${list.length} service${list.length > 1 ? 's' : ''}`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const toggleMenu = async () => {
    const next = !open;
    setOpen(next);
    if (next && services.length === 0) await fetchServices();
  };

  if (!project) return null;

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={startAll}
        disabled={busy}
        title="Start this project's dev servers"
        className="flex items-center gap-1 px-2 py-1 rounded-l bg-ide-accent hover:bg-[#1a8ad4] disabled:opacity-60 text-white"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="white" />}
        Run Dev
      </button>
      <button
        onClick={toggleMenu}
        title="Show services"
        className="px-1 py-1 rounded-r bg-ide-accent hover:bg-[#1a8ad4] text-white border-l border-white/20"
      >
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-ide-bg-light border border-ide-border rounded shadow-xl z-50 text-ide-text">
          <div className="px-3 py-2 border-b border-ide-border flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-ide-text-dim">Dev servers</span>
            {source && (
              <span className="text-[10px] text-ide-text-dim">
                {source === 'config' ? 'from cloudide.json' : 'auto-detected'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="px-3 py-3 text-[12px] text-ide-text-muted flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Scanning project…
            </div>
          ) : services.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-ide-text-muted">
              No services found. Add a <code className="text-ide-yellow">cloudide.json</code> with a
              <code className="text-ide-yellow"> services</code> array to define them.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {services.map((svc, i) => (
                <div key={i} className="px-3 py-2 border-b border-ide-border/50 last:border-0 group">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Server size={12} className="text-ide-text-muted shrink-0" />
                      <span className="text-[12px] truncate">{svc.name}</span>
                      {svc.port ? (
                        <span className="text-[10px] text-ide-text-dim">:{svc.port}</span>
                      ) : null}
                    </div>
                    <button
                      onClick={() => startOne(svc)}
                      className="text-[11px] px-2 py-0.5 rounded border border-ide-border hover:border-ide-accent shrink-0"
                    >
                      Start
                    </button>
                  </div>
                  <div className="text-[10.5px] text-ide-text-dim font-mono mt-1 truncate" title={svc.command}>
                    {svc.cwd ? `${svc.cwd}/ ` : ''}{svc.command}
                  </div>
                </div>
              ))}
              <button
                onClick={startAll}
                disabled={busy}
                className="w-full px-3 py-2 text-[12px] text-ide-accent hover:bg-ide-hover flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
                Start all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
