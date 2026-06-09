import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FilePlus, FolderPlus, X, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useFileStore } from '../../stores/fileStore';

export function NewFileDialog() {
  const { newFileDialogOpen, newFilePath, newFileIsDir, closeNewFileDialog, notify } = useUIStore();
  const { createFile } = useFileStore();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (newFileDialogOpen) setName('');
  }, [newFileDialogOpen]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    // Build full path: newFilePath is the parent dir path
    const base = newFilePath.endsWith('/') ? newFilePath : newFilePath + '/';
    const fullPath = base + name.trim();

    setLoading(true);
    try {
      await createFile(fullPath, newFileIsDir);
      notify(`Created ${newFileIsDir ? 'folder' : 'file'}: ${name}`, 'success');
      closeNewFileDialog();
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Create failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const Icon = newFileIsDir ? FolderPlus : FilePlus;

  return (
    <Dialog.Root open={newFileDialogOpen} onOpenChange={v => !v && closeNewFileDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[100] animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-[#252526] border border-ide-border shadow-2xl w-[380px] max-w-[95vw] p-5 animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[14px] font-medium text-ide-text flex items-center gap-2">
              <Icon size={16} className="text-ide-accent" />
              New {newFileIsDir ? 'Folder' : 'File'}
            </Dialog.Title>
            <Dialog.Close className="p-1 text-ide-text-dim hover:text-ide-text">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-ide-text-muted uppercase tracking-wider mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder={newFileIsDir ? 'my-folder' : 'main.py'}
                autoFocus
                className="w-full bg-ide-bg text-ide-text text-[13px] px-3 py-2 border border-ide-border focus:border-ide-accent outline-none placeholder:text-ide-text-dim"
              />
              <p className="text-[11px] text-ide-text-dim mt-1">{newFilePath}{name || '…'}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close className="px-4 py-2 text-[13px] text-ide-text border border-ide-border hover:border-ide-accent transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || loading}
                className="px-4 py-2 text-[13px] bg-ide-accent hover:bg-[#1a8ad4] text-white disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                Create
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
