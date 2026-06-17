import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, FolderOpen, Folder,
  FilePlus, FolderPlus, RefreshCw, Trash2, Edit3, Copy, Plus,
  Upload, FolderUp, Globe, ClipboardCopy,
} from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { filesApi, rawFileUrl } from '../../api/client';
import { getFileIcon, cn, getErrorMessage } from '../../utils';
import type { FileNode } from '../../types';
 
export function FileExplorer() {
  const {
    fileTree, refreshTree, loading, workspace,
    workspaces, setWorkspace, createWorkspace, loadWorkspaces,
  } = useFileStore();
  const { openNewFileDialog, openCloneDialog, notify } = useUIStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // <input webkitdirectory> isn't a standard React prop, so set it imperatively.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const fd = new FormData();
    fd.append('workspace', workspace);
    fd.append('dest', '');
    for (const file of Array.from(fileList)) {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      fd.append('files', file, rel);
    }
    setUploading(true);
    try {
      const res = await filesApi.upload(fd);
      await refreshTree();
      notify(`Uploaded ${res.count} file${res.count !== 1 ? 's' : ''}`, 'success');
    } catch (e: unknown) {
      notify(getErrorMessage(e, 'Upload failed'), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const toggleDir = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleNewWorkspace = async () => {
    const name = window.prompt('New workspace name')?.trim();
    if (!name) return;
    try {
      await createWorkspace(name);
      notify(`Workspace "${name}" created`, 'success');
    } catch (e: unknown) {
      notify(getErrorMessage(e, 'Failed to create workspace'), 'error');
    }
  };
 
  return (
    <div className="h-full flex flex-col">
      {/* Workspace switcher */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-ide-border shrink-0">
        <select
          value={workspace}
          onChange={e => setWorkspace(e.target.value)}
          title="Switch workspace"
          className="flex-1 min-w-0 bg-ide-bg text-ide-text text-[12px] px-2 py-1 border border-ide-border focus:border-ide-accent outline-none rounded"
        >
          {workspaces.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <button
          title="New Workspace"
          onClick={handleNewWorkspace}
          className="p-1 shrink-0 text-ide-text-dim hover:text-ide-text rounded hover:bg-ide-hover transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold tracking-widest text-ide-text-muted uppercase border-b border-ide-border shrink-0 select-none">
        <span>Explorer</span>
        <div className="flex items-center gap-0.5">
          <button title="New File" onClick={() => openNewFileDialog(workspace + '/', false)}
            className="p-1 hover:text-ide-text text-ide-text-dim rounded hover:bg-ide-hover transition-colors">
            <FilePlus size={13} />
          </button>
          <button title="New Folder" onClick={() => openNewFileDialog(workspace + '/', true)}
            className="p-1 hover:text-ide-text text-ide-text-dim rounded hover:bg-ide-hover transition-colors">
            <FolderPlus size={13} />
          </button>
          <button title="Upload Files" onClick={() => fileInputRef.current?.click()}
            className={cn('p-1 hover:text-ide-text text-ide-text-dim rounded hover:bg-ide-hover transition-colors', uploading && 'animate-pulse text-ide-accent')}>
            <Upload size={13} />
          </button>
          <button title="Upload Folder" onClick={() => folderInputRef.current?.click()}
            className="p-1 hover:text-ide-text text-ide-text-dim rounded hover:bg-ide-hover transition-colors">
            <FolderUp size={13} />
          </button>
          <button title="Clone Repository" onClick={openCloneDialog}
            className="p-1 hover:text-ide-text text-ide-text-dim rounded hover:bg-ide-hover transition-colors text-[11px] leading-none">
            ⎇
          </button>
          <button title="Refresh" onClick={refreshTree}
            className={cn('p-1 hover:text-ide-text text-ide-text-dim rounded hover:bg-ide-hover transition-colors', loading && 'animate-spin')}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
 
      {/* Hidden inputs that back the Upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleUpload(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={e => handleUpload(e.target.files)}
      />

      <div className="flex-1 overflow-y-auto py-1">
        {loading && !fileTree ? (
          <div className="px-4 py-6 text-ide-text-dim text-[12px] text-center">Loading…</div>
        ) : fileTree ? (
          <TreeNode
            node={fileTree}
            depth={0}
            expanded={expanded}
            renaming={renaming}
            onToggle={toggleDir}
            onRenameStart={setRenaming}
            onRenameEnd={() => setRenaming(null)}
          />
        ) : (
          <div className="px-4 py-6 text-ide-text-dim text-[12px] text-center">No workspace open</div>
        )}
      </div>
    </div>
  );
}
 
interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  renaming: string | null;
  onToggle: (path: string) => void;
  onRenameStart: (path: string) => void;
  onRenameEnd: () => void;
}
 
function TreeNode({ node, depth, expanded, renaming, onToggle, onRenameStart, onRenameEnd }: TreeNodeProps) {
  const { openFile, deleteFile, renameFile } = useFileStore();
  const { openNewFileDialog, notify, openPreview } = useUIStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = expanded.has(node.path);
  const isDir  = node.type === 'directory';
  const isHtml = /\.html?$/i.test(node.name);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(node.path);
      notify('Path copied to clipboard', 'success');
    } catch {
      notify(node.path, 'info');
    }
  };

  const handlePreview = () => {
    openPreview(rawFileUrl(node.path));
    notify(`Previewing ${node.name}`, 'info');
  };
 
  const handleRename = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newName = (e.currentTarget.value ?? '').trim();
      if (newName && newName !== node.name) {
        const parts   = node.path.split('/');
        const newPath = [...parts.slice(0, -1), newName].join('/');
        try {
          await renameFile(node.path, newPath);
          notify(`Renamed to ${newName}`, 'success');
        } catch {
          notify('Rename failed', 'error');
        }
      }
      onRenameEnd();
    }
    if (e.key === 'Escape') onRenameEnd();
  };
 
  const handleDelete = async () => {
    if (!confirm(`Delete "${node.name}"?`)) return;
    try {
      await deleteFile(node.path);
      notify(`Deleted ${node.name}`, 'info');
    } catch {
      notify('Delete failed', 'error');
    }
  };
 
  const handleDuplicate = async () => {
    const parts = node.path.split('/');
    const ext   = node.name.includes('.') ? '.' + node.name.split('.').pop() : '';
    const base  = node.name.replace(ext, '');
    const copy  = [...parts.slice(0, -1), `${base}_copy${ext}`].join('/');
    try {
      await filesApi.create(copy, false);
      const { content } = await filesApi.read(node.path);
      await filesApi.write(copy, content);
      await useFileStore.getState().refreshTree();
      notify(`Duplicated as ${base}_copy${ext}`, 'success');
    } catch {
      notify('Duplicate failed', 'error');
    }
  };
 
  const label = renaming === node.path ? (
    <input
      ref={inputRef}
      defaultValue={node.name}
      autoFocus
      className="bg-ide-bg text-ide-text text-[13px] px-1 outline-none border border-ide-accent flex-1 min-w-0"
      onKeyDown={handleRename}
      onBlur={onRenameEnd}
      onClick={e => e.stopPropagation()}
    />
  ) : (
    <span className="text-[13px] truncate flex-1 min-w-0">
      {isDir ? node.name : `${getFileIcon(node.name)} ${node.name}`}
    </span>
  );
 
  const row = (
    <div
      className="flex items-center h-[22px] cursor-pointer rounded-sm hover:bg-ide-hover transition-colors group"
      style={{ paddingLeft: `${depth * 12 + 4}px`, paddingRight: 4 }}
      onClick={() => isDir ? onToggle(node.path) : openFile(node)}
    >
      <span className="shrink-0 w-4 flex items-center justify-center text-ide-text-muted">
        {isDir ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
      </span>
      <span className="shrink-0 w-4 flex items-center justify-center mr-1">
        {isDir
          ? (isOpen
              ? <FolderOpen size={13} className="text-[#dcb67a]" />
              : <Folder size={13} className="text-[#dcb67a]" />)
          : null}
      </span>
      {label}
    </div>
  );
 
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div>
          {row}
          {isDir && isOpen && node.children && (
            <div>
              {node.children.map(child => (
                <TreeNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  renaming={renaming}
                  onToggle={onToggle}
                  onRenameStart={onRenameStart}
                  onRenameEnd={onRenameEnd}
                />
              ))}
            </div>
          )}
        </div>
      </ContextMenu.Trigger>
 
      <ContextMenu.Portal>
        <ContextMenu.Content className="bg-[#252526] border border-ide-border shadow-xl py-1 min-w-[180px] z-50 animate-fade-in">
          {isHtml && (
            <>
              <ContextMenu.Item className="ctx-item" onClick={handlePreview}>
                <Globe size={13} /> Open in Preview
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-ide-border" />
            </>
          )}
          {isDir && (
            <>
              <ContextMenu.Item
                className="ctx-item"
                onClick={() => openNewFileDialog(node.path + '/', false)}
              >
                <FilePlus size={13} /> New File
              </ContextMenu.Item>
              <ContextMenu.Item
                className="ctx-item"
                onClick={() => openNewFileDialog(node.path + '/', true)}
              >
                <FolderPlus size={13} /> New Folder
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-ide-border" />
            </>
          )}
          <ContextMenu.Item className="ctx-item" onClick={handleCopyPath}>
            <ClipboardCopy size={13} /> Copy Path
          </ContextMenu.Item>
          {depth > 0 && (
            <>
              <ContextMenu.Separator className="my-1 h-px bg-ide-border" />
              <ContextMenu.Item className="ctx-item" onClick={() => onRenameStart(node.path)}>
                <Edit3 size={13} /> Rename
              </ContextMenu.Item>
              {!isDir && (
                <ContextMenu.Item className="ctx-item" onClick={handleDuplicate}>
                  <Copy size={13} /> Duplicate
                </ContextMenu.Item>
              )}
              <ContextMenu.Separator className="my-1 h-px bg-ide-border" />
              <ContextMenu.Item className="ctx-item text-ide-red hover:bg-ide-selected" onClick={handleDelete}>
                <Trash2 size={13} /> Delete
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
