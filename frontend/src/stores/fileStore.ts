import { create } from 'zustand';
import { FileNode, OpenTab } from '../types';
import { filesApi } from '../api/client';

interface FileStore {
  workspace: string;
  fileTree: FileNode | null;
  openTabs: OpenTab[];
  activeTabPath: string | null;
  loading: boolean;
  error: string | null;

  setWorkspace: (ws: string) => void;
  refreshTree: () => Promise<void>;
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
  fileTree: null,
  openTabs: [],
  activeTabPath: null,
  loading: false,
  error: null,

  setWorkspace: (ws) => set({ workspace: ws }),

  refreshTree: async () => {
    set({ loading: true, error: null });
    try {
      const tree = await filesApi.tree(get().workspace);
      set({ fileTree: tree, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
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
    } catch (e: any) {
      set({ error: e.message });
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
    await filesApi.write(path, tab.content);
    set(state => ({
      openTabs: state.openTabs.map(t =>
        t.path === path ? { ...t, modified: false } : t,
      ),
    }));
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
