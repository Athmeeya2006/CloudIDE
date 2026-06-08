import { create } from 'zustand';
import { SidebarView, BottomView } from '../types';

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
  notification: { message: string; type: 'info' | 'error' | 'success' } | null;

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
  notify: (message: string, type?: 'info' | 'error' | 'success') => void;
}

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
  notify: (message, type = 'info') => {
    set({ notification: { message, type } });
    setTimeout(() => set({ notification: null }), 3500);
  },
}));
