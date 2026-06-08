import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, GitBranch } from 'lucide-react';
import { gitApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';

export function CloneDialog() {
  const { cloneDialogOpen, closeCloneDialog, notify } = useUIStore();
  const { refreshTree, workspace } = useFileStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const doClone = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await gitApi.clone(url, workspace);
      notify('Repository cloned!', 'success');
      refreshTree();
      closeCloneDialog();
      setUrl('');
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Clone failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={cloneDialogOpen} onOpenChange={open => !open && closeCloneDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-ide-bg-light border border-ide-border rounded-lg p-6 w-[460px] z-50 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-ide-text font-medium flex items-center gap-2">
              <GitBranch size={16} /> Clone Repository
            </Dialog.Title>
            <Dialog.Close className="text-ide-text-dim hover:text-ide-text">
              <X size={16} />
            </Dialog.Close>
          </div>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doClone()}
            placeholder="https://github.com/user/repo.git"
            className="w-full bg-ide-bg text-ide-text text-[13px] px-3 py-2 outline-none border border-ide-border focus:border-ide-accent mb-4 placeholder:text-ide-text-dim"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={closeCloneDialog} className="px-4 py-1.5 text-[13px] text-ide-text-muted hover:text-ide-text border border-ide-border hover:border-ide-accent transition-colors">
              Cancel
            </button>
            <button onClick={doClone} disabled={!url.trim() || loading} className="px-4 py-1.5 text-[13px] bg-ide-accent text-white hover:bg-[#1a8ad4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? 'Cloning...' : 'Clone'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
