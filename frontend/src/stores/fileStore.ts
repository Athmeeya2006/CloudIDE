import { create } from 'zustand';
import { FileNode, OpenTab } from '../types';
import { filesApi } from '../api/client';
import { getErrorMessage } from '../utils';
import { useUIStore } from './uiStore';

interface FileStore {
  workspace: string;
  workspaces: string[];
  fileTree: FileNode | null;
  openTabs: OpenTab[];
  activeTabPath: string | null;
  loading: boolean;
  error: string | null;

  refreshTree: () => Promise<void>;
  loadWorkspaces: () => Promise<void>;
  setWorkspace: (name: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  openFile: (node: FileNode) => Promise<void>;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveActiveFile: () => Promise<void>;
  saveFile: (path: string) => Promise<void>;
  createFile: (path: string, is_dir?: boolean) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
}

export const useFileStore = create<FileStore>((set, get) => ({
  workspace: 'default',
  workspaces: ['default'],
  fileTree: null,
  openTabs: [],
  activeTabPath: null,
  loading: false,
  error: null,

  refreshTree: async () => {
    set({ loading: true, error: null });
    try {
      const tree = await filesApi.tree(get().workspace);
      set({ fileTree: tree, loading: false });
    } catch (e: unknown) {
      set({ error: getErrorMessage(e, 'Failed to load file tree'), loading: false });
    }
  },

  loadWorkspaces: async () => {
    try {
      const data = await filesApi.listWorkspaces();
      set({ workspaces: data.workspaces ?? ['default'] });
    } catch {
      set({ workspaces: ['default'] });
    }
  },

  setWorkspace: async (name) => {
    if (name === get().workspace) return;
    // Open tabs are workspace-relative, so they no longer apply.
    set({ workspace: name, openTabs: [], activeTabPath: null, fileTree: null });
    await get().refreshTree();
  },

  createWorkspace: async (name) => {
    await filesApi.createWorkspace(name);
    await get().loadWorkspaces();
    await get().setWorkspace(name);
  },

  openFile: async (node) => {
    if (node.type === 'directory') return;
    const { openTabs } = get();

    // Already open - just activate
    if (openTabs.some(t => t.path === node.path)) {
      set({ activeTabPath: node.path });
      return;
    }

    try {
      const data = await filesApi.read(node.path);
      if (data.encoding === 'binary' || data.error) {
        useUIStore.getState().notify(
          data.error || 'Cannot open binary file',
          'error',
        );
        return;
      }
      const tab: OpenTab = {
        path: node.path,
        name: node.name,
        content: data.content || '',
        modified: false,
      };
      set({
        openTabs: [...openTabs, tab],
        activeTabPath: node.path,
      });
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Failed to open file');
      set({ error: msg });
      useUIStore.getState().notify(msg, 'error');
    }
  },

  closeTab: (path) => {
    const { openTabs, activeTabPath } = get();
    const idx = openTabs.findIndex(t => t.path === path);
    const newTabs = openTabs.filter(t => t.path !== path);
    let newActive = activeTabPath;
    if (activeTabPath === path) {
      newActive = newTabs[idx]?.path ?? newTabs[idx - 1]?.path ?? null;
    }
    set({ openTabs: newTabs, activeTabPath: newActive });
  },

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateContent: (path, content) => {
    set(state => ({
      openTabs: state.openTabs.map(t =>
        t.path === path ? { ...t, content, modified: true } : t,
      ),
    }));
  },

  saveActiveFile: async () => {
    const { activeTabPath } = get();
    if (activeTabPath) await get().saveFile(activeTabPath);
  },

  saveFile: async (path) => {
    const tab = get().openTabs.find(t => t.path === path);
    if (!tab) return;
    try {
      await filesApi.write(path, tab.content);
      set(state => ({
        openTabs: state.openTabs.map(t =>
          t.path === path ? { ...t, modified: false } : t,
        ),
      }));
    } catch (e: unknown) {
      useUIStore.getState().notify(getErrorMessage(e, 'Failed to save file'), 'error');
      throw e;
    }
  },

  createFile: async (path, is_dir = false) => {
    await filesApi.create(path, is_dir);
    await get().refreshTree();
  },

  renameFile: async (oldPath, newPath) => {
    await filesApi.rename(oldPath, newPath);
    set(state => ({
      openTabs: state.openTabs.map(t =>
        t.path === oldPath ? { ...t, path: newPath, name: newPath.split('/').pop() || t.name } : t,
      ),
      activeTabPath: state.activeTabPath === oldPath ? newPath : state.activeTabPath,
    }));
    await get().refreshTree();
  },

  deleteFile: async (path) => {
    await filesApi.delete(path);
    const { openTabs } = get();
    if (openTabs.some(t => t.path === path)) {
      get().closeTab(path);
    }
    await get().refreshTree();
  },
}));
