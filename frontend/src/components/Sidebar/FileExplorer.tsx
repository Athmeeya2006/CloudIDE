import { useState, useRef } from 'react';
import {
  ChevronRight, ChevronDown, FolderOpen, Folder,
  FilePlus, FolderPlus, RefreshCw, Trash2, Edit3,
} from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { getFileIcon, cn } from '../../utils';
import type { FileNode } from '../../types';

export function FileExplorer() {
  const {
    fileTree,
    refreshTree,
    loading,
    workspace,
  } = useFileStore();
  const { openNewFileDialog, openCloneDialog, notify } = useUIStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']));
  const [renaming, setRenaming] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const toggleDir = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold tracking-widest text-ide-text-muted uppercase border-b border-ide-border shrink-0">
        <span>Explorer</span>
        <div className="flex items-center gap-1">
          <button title="New File" onClick={() => openNewFileDialog(workspace + '/', false)} className="p-0.5 hover:text-ide-text text-ide-text-dim transition-colors">
            <FilePlus size={14} />
          </button>
          <button title="New Folder" onClick={() => openNewFileDialog(workspace + '/', true)} className="p-0.5 hover:text-ide-text text-ide-text-dim transition-colors">
            <FolderPlus size={14} />
          </button>
          <button title="Clone Repository" onClick={openCloneDialog} className="p-0.5 hover:text-ide-text text-ide-text-dim transition-colors">
            <span className="text-[10px]">⎇</span>
          </button>
          <button title="Refresh" onClick={refreshTree} className={cn('p-0.5 hover:text-ide-text text-ide-text-dim transition-colors', loading && 'animate-spin')}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {fileTree ? (
          <TreeNode node={fileTree} depth={0} expanded={expanded} renaming={renaming} renameRef={renameRef} onToggle={toggleDir} onRenameStart={setRenaming} onRenameEnd={() => setRenaming(null)} />
        ) : (
          <div className="px-4 py-8 text-ide-text-dim text-xs text-center">
            {loading ? 'Loading...' : 'No workspace open'}
          </div>
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
  renameRef: React.RefObject<HTMLInputElement>;
  onToggle: (path: string) => void;
  onRenameStart: (path: string) => void;
  onRenameEnd: () => void;
}

function TreeNode({ node, depth, expanded, renaming, renameRef, onToggle, onRenameStart, onRenameEnd }: TreeNodeProps) {
  const { openFile, deleteFile, renameFile } = useFileStore();
  const { openNewFileDialog, notify } = useUIStore();
  const isOpen = expanded.has(node.path);
  const isDir = node.type === 'directory';

  const handleRename = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newName = (e.target as HTMLInputElement).value.trim();
      if (newName && newName !== node.name) {
        const newPath = node.path.replace(node.name, newName);
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

  const label = renaming === node.path ? (
    <input
      ref={renameRef as React.RefObject<HTMLInputElement>}
      defaultValue={node.name}
      autoFocus
      className="bg-ide-bg-lighter text-ide-text text-[13px] px-1 outline-none border border-ide-accent w-full"
      onKeyDown={handleRename}
      onBlur={onRenameEnd}
      onClick={e => e.stopPropagation()}
    />
  ) : (
    <span className="text-[13px] truncate">{isDir ? node.name : `${getFileIcon(node.name)} ${node.name}`}</span>
  );

  const row = (
    <div
      className="flex items-center gap-1 h-[22px] px-1 cursor-pointer rounded-sm hover:bg-ide-hover transition-colors group"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => { if (isDir) onToggle(node.path); else openFile(node); }}
    >
      <span className="shrink-0 text-ide-text-muted w-4 flex items-center justify-center">
        {isDir ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
      </span>
      <span className="shrink-0 text-ide-text-muted w-4 flex items-center justify-center">
        {isDir ? (isOpen ? <FolderOpen size={14} className="text-[#dcb67a]" /> : <Folder size={14} className="text-[#dcb67a]" />) : null}
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
                <TreeNode key={child.path} node={child} depth={depth + 1} expanded={expanded} renaming={renaming} renameRef={renameRef} onToggle={onToggle} onRenameStart={onRenameStart} onRenameEnd={onRenameEnd} />
              ))}
            </div>
          )}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="bg-[#252526] border border-ide-border rounded shadow-xl py-1 min-w-[180px] z-50 animate-fade-in">
          {isDir && (
            <>
              <ContextMenu.Item className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-ide-text hover:bg-ide-selected cursor-pointer outline-none" onClick={() => openNewFileDialog(node.path + '/', false)}>
                <FilePlus size={13} /> New File
              </ContextMenu.Item>
              <ContextMenu.Item className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-ide-text hover:bg-ide-selected cursor-pointer outline-none" onClick={() => openNewFileDialog(node.path + '/', true)}>
                <FolderPlus size={13} /> New Folder
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-ide-border" />
            </>
          )}
          {depth > 0 && (
            <>
              <ContextMenu.Item className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-ide-text hover:bg-ide-selected cursor-pointer outline-none" onClick={() => onRenameStart(node.path)}>
                <Edit3 size={13} /> Rename
              </ContextMenu.Item>
              <ContextMenu.Item className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-ide-red hover:bg-ide-selected cursor-pointer outline-none" onClick={handleDelete}>
                <Trash2 size={13} /> Delete
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
