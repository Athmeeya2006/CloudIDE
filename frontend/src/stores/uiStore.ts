import { create } from 'zustand';
import { SidebarView, BottomView, EditorSettings } from '../types';

interface UIStore {
  sidebarView: SidebarView;
  bottomView: BottomView;
  sidebarOpen: boolean;
  bottomOpen: boolean;
  previewOpen: boolean;
  previewUrl: string;
  cloneDialogOpen: boolean;
  newFileDialogOpen: boolean;
  newFilePath: string;
  newFileIsDir: boolean;
  quickOpenOpen: boolean;
  settingsOpen: boolean;
  gitBranch: string;
  gitChanges: number;
  editorSettings: EditorSettings;
  notification: { message: string; type: 'info' | 'error' | 'success'; id: number } | null;

  setSidebarView: (v: SidebarView) => void;
  setBottomView: (v: BottomView) => void;
  toggleSidebar: () => void;
  openSidebar: (v?: SidebarView) => void;
  closeSidebar: () => void;
  toggleBottom: () => void;
  openBottom: (v?: BottomView) => void;
  setPreviewUrl: (url: string) => void;
  togglePreview: () => void;
  openCloneDialog: () => void;
  closeCloneDialog: () => void;
  openNewFileDialog: (path: string, isDir?: boolean) => void;
  closeNewFileDialog: () => void;
  openQuickOpen: () => void;
  closeQuickOpen: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setGitBranch: (branch: string) => void;
  setGitChanges: (n: number) => void;
  updateEditorSettings: (s: Partial<EditorSettings>) => void;
  notify: (message: string, type?: 'info' | 'error' | 'success') => void;
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  lineNumbers: true,
  formatOnSave: false,
};

let notifCounter = 0;

export const useUIStore = create<UIStore>((set) => ({
  sidebarView: 'explorer',
  bottomView: 'terminal',
  sidebarOpen: true,
  bottomOpen: true,
  previewOpen: false,
  previewUrl: '',
  cloneDialogOpen: false,
  newFileDialogOpen: false,
  newFilePath: '',
  newFileIsDir: false,
  quickOpenOpen: false,
  settingsOpen: false,
  gitBranch: '',
  gitChanges: 0,
  editorSettings: DEFAULT_EDITOR_SETTINGS,
  notification: null,

  setSidebarView: (v) => set({ sidebarView: v }),
  setBottomView: (v) => set({ bottomView: v }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  openSidebar: (v) => set(s => ({ sidebarOpen: true, sidebarView: v ?? s.sidebarView })),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleBottom: () => set(s => ({ bottomOpen: !s.bottomOpen })),
  openBottom: (v) => set(s => ({ bottomOpen: true, bottomView: v ?? s.bottomView })),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  togglePreview: () => set(s => ({ previewOpen: !s.previewOpen })),
  openCloneDialog: () => set({ cloneDialogOpen: true }),
  closeCloneDialog: () => set({ cloneDialogOpen: false }),
  openNewFileDialog: (path, isDir = false) =>
    set({ newFileDialogOpen: true, newFilePath: path, newFileIsDir: isDir }),
  closeNewFileDialog: () => set({ newFileDialogOpen: false }),
  openQuickOpen: () => set({ quickOpenOpen: true }),
  closeQuickOpen: () => set({ quickOpenOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setGitBranch: (branch) => set({ gitBranch: branch }),
  setGitChanges: (n) => set({ gitChanges: n }),
  updateEditorSettings: (s) =>
    set(state => ({ editorSettings: { ...state.editorSettings, ...s } })),
  notify: (message, type = 'info') => {
    const id = ++notifCounter;
    set({ notification: { message, type, id } });
    setTimeout(() => set(s => s.notification?.id === id ? { notification: null } : s), 3500);
  },
}));
