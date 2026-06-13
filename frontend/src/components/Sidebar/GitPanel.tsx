import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, RefreshCw, Check, CloudDownload, CloudUpload,
  ChevronLeft, FileDiff, Loader2,
} from 'lucide-react';
import { gitApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils';
import type { GitStatus } from '../../types';
 
// ---- Diff Viewer ----
interface DiffLine {
  type: 'add' | 'del' | 'meta' | 'context' | 'hunk';
  content: string;
}
 
export function parseDiff(raw: string): DiffLine[] {
  return raw.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add', content: line };
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'del', content: line };
    if (line.startsWith('@@'))                            return { type: 'hunk', content: line };
    if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      return { type: 'meta', content: line };
    }
    return { type: 'context', content: line };
  });
}
 
function DiffViewer({ diff, onClose }: { diff: string; onClose: () => void }) {
  const lines = parseDiff(diff);
  const additions = lines.filter(l => l.type === 'add').length;
  const deletions = lines.filter(l => l.type === 'del').length;
 
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-ide-border shrink-0">
        <div className="flex items-center gap-2 text-[12px]">
          <FileDiff size={13} className="text-ide-accent" />
          <span className="text-ide-text font-medium">Diff</span>
          <span className="text-green-400 font-mono">+{additions}</span>
          <span className="text-red-400 font-mono">-{deletions}</span>
        </div>
        <button onClick={onClose} className="p-1 text-ide-text-dim hover:text-ide-text rounded hover:bg-ide-hover" title="Back">
          <ChevronLeft size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-5">
        {diff.trim() === '' ? (
          <div className="p-4 text-ide-text-dim">No changes to display</div>
        ) : (
          lines.map((line, i) => {
            let bg = '';
            let textCls = 'text-ide-text';
            if (line.type === 'add')     { bg = 'bg-green-900/20'; textCls = 'text-green-400'; }
            if (line.type === 'del')     { bg = 'bg-red-900/20';   textCls = 'text-red-400'; }
            if (line.type === 'hunk')    { bg = 'bg-blue-900/15';  textCls = 'text-blue-400'; }
            if (line.type === 'meta')    { textCls = 'text-ide-text-dim'; }
            if (line.type === 'context') { textCls = 'text-ide-text-muted'; }
            return (
              <div key={i} className={cn('px-3 py-0 whitespace-pre', bg)}>
                <span className={textCls}>{line.content || ' '}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
 
// ---- Status badge ----
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    M:  { label: 'M', cls: 'text-yellow-400 bg-yellow-400/10' },
    A:  { label: 'A', cls: 'text-green-400 bg-green-400/10' },
    D:  { label: 'D', cls: 'text-red-400 bg-red-400/10' },
    R:  { label: 'R', cls: 'text-blue-400 bg-blue-400/10' },
    C:  { label: 'C', cls: 'text-purple-400 bg-purple-400/10' },
    U:  { label: 'U', cls: 'text-orange-400 bg-orange-400/10' },
    '??':{ label: '?', cls: 'text-ide-text-dim bg-ide-hover' },
  };
  const cfg = map[status] ?? { label: status, cls: 'text-ide-text-dim' };
  return (
    <span className={cn('text-[10px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded shrink-0', cfg.cls)}>
      {cfg.label}
    </span>
  );
}
 
// ---- Main GitPanel ----
export function GitPanel() {
  const { workspace } = useFileStore();
  const { notify, setGitBranch, setGitChanges } = useUIStore();
 
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'pull' | 'push' | 'commit' | null>(null);
  const [diffView, setDiffView] = useState<{ file: string; content: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [view, setView] = useState<'changes' | 'history'>('changes');
  const [history, setHistory] = useState<{ hash: string; author: string; date: string; message: string }[]>([]);
 
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: GitStatus = await gitApi.status(workspace);
      setStatus(data);
      setGitBranch(data.branch || '');
      setGitChanges(data.files?.length ?? 0);
    } catch {
      setStatus(null);
      setGitBranch('');
      setGitChanges(0);
    } finally {
      setLoading(false);
    }
  }, [workspace, setGitBranch, setGitChanges]);
 
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000); // poll every 10s
    return () => clearInterval(id);
  }, [refresh]);
 
  const loadHistory = async () => {
    try {
      const data = await gitApi.log(workspace);
      setHistory(data.commits ?? []);
    } catch {
      setHistory([]);
    }
  };
 
  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, workspace]);
 
  const showDiff = async (file: string) => {
    setDiffLoading(true);
    try {
      const data = await gitApi.diff(workspace, '', file);
      setDiffView({ file, content: data.diff ?? '' });
    } catch {
      notify('Failed to load diff', 'error');
    } finally {
      setDiffLoading(false);
    }
  };
 
  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    setActionLoading('commit');
    try {
      await gitApi.commit(commitMsg, workspace);
      setCommitMsg('');
      notify('Committed successfully', 'success');
      await refresh();
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Commit failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };
 
  const doPull = async () => {
    setActionLoading('pull');
    try {
      const res = await gitApi.pull(workspace);
      notify(res.output?.trim() || 'Up to date', 'success');
      await refresh();
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Pull failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };
 
  const doPush = async () => {
    setActionLoading('push');
    try {
      await gitApi.push(workspace);
      notify('Pushed successfully', 'success');
      await refresh();
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Push failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };
 
  // Diff view overlay
  if (diffView) {
    return <DiffViewer diff={diffView.content} onClose={() => setDiffView(null)} />;
  }
 
  if (!status) {
    return (
      <div className="h-full flex flex-col">
        <Header loading={loading} onRefresh={refresh} branch={null} />
        <div className="flex-1 flex items-center justify-center text-ide-text-dim text-[12px] text-center px-6">
          {loading ? (
            <Loader2 size={18} className="animate-spin text-ide-accent" />
          ) : (
            <div>
              <p className="mb-2">Not a git repository</p>
              <p className="text-[11px] opacity-60">
                Run <code className="bg-ide-hover px-1 rounded">git init</code> in the terminal or clone a repo
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
 
  const { files = [], branch, ahead = 0, behind = 0 } = status;
 
  return (
    <div className="h-full flex flex-col">
      <Header loading={loading} onRefresh={refresh} branch={branch} ahead={ahead} behind={behind} onPull={doPull} onPush={doPush} actionLoading={actionLoading} />
 
      {/* Sub-tabs */}
      <div className="flex border-b border-ide-border shrink-0">
        {(['changes', 'history'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 py-1.5 text-[12px] capitalize transition-colors border-b-2',
              view === v
                ? 'border-b-ide-accent text-ide-text bg-ide-bg'
                : 'border-b-transparent text-ide-text-dim hover:text-ide-text',
            )}
          >
            {v === 'changes' ? `Changes (${files.length})` : 'History'}
          </button>
        ))}
      </div>
 
      {view === 'changes' ? (
        <>
          {/* Changed files list */}
          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-ide-text-dim text-[12px] gap-1">
                <Check size={18} className="text-green-400" />
                No changes
              </div>
            ) : (
              files.map(f => (
                <button
                  key={f.path}
                  onClick={() => showDiff(f.path)}
                  disabled={diffLoading}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-ide-hover group transition-colors"
                  title={`View diff: ${f.path}`}
                >
                  <StatusBadge status={f.status} />
                  <span className="text-[12px] text-ide-text truncate flex-1">{f.path}</span>
                  <FileDiff size={11} className="text-ide-text-dim opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                </button>
              ))
            )}
          </div>
 
          {/* Commit area */}
          <div className="border-t border-ide-border p-3 shrink-0 bg-[#252526]">
            <textarea
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  doCommit();
                }
              }}
              placeholder="Message (Ctrl+Enter to commit)"
              rows={2}
              className="w-full bg-ide-bg text-ide-text text-[12px] px-2 py-1.5 outline-none border border-ide-border focus:border-ide-accent placeholder:text-ide-text-dim resize-none mb-2"
            />
            <button
              onClick={doCommit}
              disabled={!commitMsg.trim() || actionLoading === 'commit'}
              className="w-full bg-ide-accent text-white text-[12px] py-1.5 flex items-center justify-center gap-1.5 hover:bg-[#1a8ad4] disabled:opacity-40 transition-colors"
            >
              {actionLoading === 'commit'
                ? <Loader2 size={12} className="animate-spin" />
                : <Check size={12} />}
              Commit All
            </button>
          </div>
        </>
      ) : (
        /* History view */
        <div className="flex-1 overflow-y-auto py-1 min-h-0">
          {history.length === 0 ? (
            <div className="p-4 text-ide-text-dim text-[12px] text-center">No commits yet</div>
          ) : (
            history.map(c => (
              <div key={c.hash} className="px-3 py-2 border-b border-ide-border/40 hover:bg-ide-hover transition-colors">
                <div className="text-[12px] text-ide-text font-medium truncate">{c.message}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ide-text-dim">
                  <code className="text-ide-accent">{c.hash.slice(0, 7)}</code>
                  <span>{c.author}</span>
                  <span>{new Date(c.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
 
function Header({
  loading, onRefresh, branch, ahead = 0, behind = 0,
  onPull, onPush, actionLoading,
}: {
  loading: boolean;
  onRefresh: () => void;
  branch: string | null;
  ahead?: number;
  behind?: number;
  onPull?: () => void;
  onPush?: () => void;
  actionLoading?: string | null;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-ide-border shrink-0">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ide-text-muted uppercase tracking-widest truncate min-w-0">
        <GitBranch size={12} className="shrink-0 text-ide-accent" />
        <span className="truncate">{branch || 'Source Control'}</span>
        {behind > 0 && (
          <span className="text-orange-400 font-mono normal-case tracking-normal text-[10px]">↓{behind}</span>
        )}
        {ahead > 0 && (
          <span className="text-green-400 font-mono normal-case tracking-normal text-[10px]">↑{ahead}</span>
        )}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        {onPull && (
          <button
            title="Pull (git pull)"
            onClick={onPull}
            disabled={actionLoading === 'pull'}
            className="p-1.5 hover:text-ide-text text-ide-text-dim hover:bg-ide-hover rounded transition-colors disabled:opacity-40"
          >
            {actionLoading === 'pull'
              ? <Loader2 size={12} className="animate-spin" />
              : <CloudDownload size={13} />}
          </button>
        )}
        {onPush && (
          <button
            title="Push (git push)"
            onClick={onPush}
            disabled={actionLoading === 'push'}
            className="p-1.5 hover:text-ide-text text-ide-text-dim hover:bg-ide-hover rounded transition-colors disabled:opacity-40"
          >
            {actionLoading === 'push'
              ? <Loader2 size={12} className="animate-spin" />
              : <CloudUpload size={13} />}
          </button>
        )}
        <button
          onClick={onRefresh}
          className={cn('p-1.5 hover:text-ide-text text-ide-text-dim hover:bg-ide-hover rounded transition-colors', loading && 'animate-spin')}
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>
    </div>
  );
}
