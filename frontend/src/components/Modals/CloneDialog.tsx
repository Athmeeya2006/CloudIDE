import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { GitBranch, X, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useFileStore } from '../../stores/fileStore';
import { gitApi } from '../../api/client';

export function CloneDialog() {
  const { cloneDialogOpen, closeCloneDialog, notify } = useUIStore();
  const { workspace, refreshTree } = useFileStore();
  const [url, setUrl] = useState('');
  const [folder, setFolder] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClone = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const result = await gitApi.clone(url.trim(), workspace, folder.trim() || undefined);
      notify(`Cloned to ${result.path}`, 'success');
      await refreshTree();
      closeCloneDialog();
      setUrl('');
      setFolder('');
    } catch (e: any) {
      notify(e.response?.data?.detail || e.message || 'Clone failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const suggestFolder = (repoUrl: string) => {
    const name = repoUrl.split('/').pop()?.replace(/\.git$/, '') || '';
    if (name && !folder) setFolder(name);
  };

  return (
    <Dialog.Root open={cloneDialogOpen} onOpenChange={v => !v && closeCloneDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[100] animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-[#252526] border border-ide-border shadow-2xl w-[480px] max-w-[95vw] p-5 animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[14px] font-medium text-ide-text flex items-center gap-2">
              <GitBranch size={16} className="text-ide-accent" />
              Clone Repository
            </Dialog.Title>
            <Dialog.Close className="p-1 text-ide-text-dim hover:text-ide-text transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-ide-text-muted uppercase tracking-wider mb-1">Repository URL</label>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); suggestFolder(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && handleClone()}
                placeholder="https://github.com/user/repo.git"
                autoFocus
                className="w-full bg-ide-bg text-ide-text text-[13px] px-3 py-2 border border-ide-border focus:border-ide-accent outline-none placeholder:text-ide-text-dim"
              />
            </div>

            <div>
              <label className="block text-[11px] text-ide-text-muted uppercase tracking-wider mb-1">
                Folder Name <span className="normal-case text-ide-text-dim">(optional)</span>
              </label>
              <input
                value={folder}
                onChange={e => setFolder(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClone()}
                placeholder="my-project"
                className="w-full bg-ide-bg text-ide-text text-[13px] px-3 py-2 border border-ide-border focus:border-ide-accent outline-none placeholder:text-ide-text-dim"
              />
              <p className="text-[11px] text-ide-text-dim mt-1">
                Will be cloned into /workspaces/{workspace}/{folder || '&lt;repo-name&gt;'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close className="px-4 py-2 text-[13px] text-ide-text border border-ide-border hover:border-ide-accent transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleClone}
                disabled={!url.trim() || loading}
                className="px-4 py-2 text-[13px] bg-ide-accent hover:bg-[#1a8ad4] text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
                Clone
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
