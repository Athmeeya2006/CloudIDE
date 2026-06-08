import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, FilePlus, FolderPlus } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';

export function NewFileDialog() {
  const { newFileDialogOpen, closeNewFileDialog, newFilePath, newFileIsDir, notify } = useUIStore();
  const { createFile, refreshTree } = useFileStore();
  const [name, setName] = useState('');

  useEffect(() => { if (newFileDialogOpen) setName(''); }, [newFileDialogOpen]);

  const doCreate = async () => {
    if (!name.trim()) return;
    const fullPath = newFilePath + name;
    try {
      await createFile(fullPath, newFileIsDir);
      notify(`Created ${name}`, 'success');
      closeNewFileDialog();
    } catch (e: any) {
      notify(e.response?.data?.detail || 'Create failed', 'error');
    }
  };

  return (
    <Dialog.Root open={newFileDialogOpen} onOpenChange={open => !open && closeNewFileDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-ide-bg-light border border-ide-border rounded-lg p-6 w-[400px] z-50 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-ide-text font-medium flex items-center gap-2">
              {newFileIsDir ? <FolderPlus size={16} /> : <FilePlus size={16} />}
              {newFileIsDir ? 'New Folder' : 'New File'}
            </Dialog.Title>
            <Dialog.Close className="text-ide-text-dim hover:text-ide-text">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="text-[11px] text-ide-text-dim mb-2">In: {newFilePath}</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doCreate()}
            placeholder={newFileIsDir ? 'folder-name' : 'filename.ext'}
            className="w-full bg-ide-bg text-ide-text text-[13px] px-3 py-2 outline-none border border-ide-border focus:border-ide-accent mb-4 placeholder:text-ide-text-dim"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={closeNewFileDialog} className="px-4 py-1.5 text-[13px] text-ide-text-muted hover:text-ide-text border border-ide-border hover:border-ide-accent transition-colors">
              Cancel
            </button>
            <button onClick={doCreate} disabled={!name.trim()} className="px-4 py-1.5 text-[13px] bg-ide-accent text-white hover:bg-[#1a8ad4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Create
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
