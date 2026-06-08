import { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, Check } from 'lucide-react';
import { gitApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import type { GitFile } from '../../types';

export function GitPanel() {
  const { workspace } = useFileStore();
  const { notify } = useUIStore();
  const [status, setStatus] = useState<{ files: GitFile[]; branch: string } | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await gitApi.status(workspace);
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [workspace]);

  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    try {
      await gitApi.commit(commitMsg, workspace);
      setCommitMsg('');
      notify('Committed!', 'success');
      refresh();
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Commit failed', 'error');
    }
  };

  const statusColor = (s: string) => {
    if (s === 'M') return 'text-yellow-400';
    if (s === 'A' || s === '??') return 'text-ide-green';
    if (s === 'D') return 'text-ide-red';
    return 'text-ide-text';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold tracking-widest text-ide-text-muted uppercase border-b border-ide-border shrink-0">
        <span className="flex items-center gap-1">
          <GitBranch size={12} />
          {status?.branch || 'Source Control'}
        </span>
        <button onClick={refresh} className={`p-0.5 hover:text-ide-text ${loading ? 'animate-spin' : ''}`}>
          <RefreshCw size={12} />
        </button>
      </div>

      {status ? (
        <>
          <div className="flex-1 overflow-y-auto py-1">
            {status.files.length === 0 ? (
              <div className="text-ide-text-dim text-xs px-4 py-4">No changes</div>
            ) : (
              status.files.map(f => (
                <div key={f.path} className="flex items-center gap-2 px-3 py-1 hover:bg-ide-hover">
                  <span className={`text-[11px] font-mono w-4 ${statusColor(f.status)}`}>{f.status}</span>
                  <span className="text-[13px] text-ide-text truncate">{f.path}</span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-ide-border p-2 shrink-0">
            <input
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCommit()}
              placeholder="Commit message..."
              className="w-full bg-ide-bg-lighter text-ide-text text-[13px] px-2 py-1.5 outline-none border border-ide-border focus:border-ide-accent placeholder:text-ide-text-dim mb-1"
            />
            <button
              onClick={doCommit}
              disabled={!commitMsg.trim()}
              className="w-full bg-ide-accent text-white text-[13px] py-1.5 flex items-center justify-center gap-1 hover:bg-[#1a8ad4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={13} /> Commit All
            </button>
          </div>
        </>
      ) : (
        <div className="text-ide-text-dim text-xs px-4 py-4">
          Not a git repository.<br />
          Clone a repo or run `git init` in the terminal.
        </div>
      )}
    </div>
  );
}
