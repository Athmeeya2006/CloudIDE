import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidebarOpen: true,
    bottomOpen: true,
    bottomView: 'terminal',
    sidebarView: 'explorer',
    notification: null,
    editorSettings: {
      fontSize: 14, tabSize: 2, wordWrap: false,
      minimap: true, lineNumbers: true, formatOnSave: false,
    },
  });
});

describe('uiStore', () => {
  it('toggles the sidebar', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it('openBottom opens the panel and sets the view', () => {
    useUIStore.setState({ bottomOpen: false });
    useUIStore.getState().openBottom('logs');
    expect(useUIStore.getState().bottomOpen).toBe(true);
    expect(useUIStore.getState().bottomView).toBe('logs');
  });

  it('openSidebar keeps the current view when none is given', () => {
    useUIStore.setState({ sidebarOpen: false, sidebarView: 'git' });
    useUIStore.getState().openSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    expect(useUIStore.getState().sidebarView).toBe('git');
  });

  it('merges partial editor settings', () => {
    useUIStore.getState().updateEditorSettings({ fontSize: 18 });
    expect(useUIStore.getState().editorSettings.fontSize).toBe(18);
    expect(useUIStore.getState().editorSettings.tabSize).toBe(2);
  });

  it('notify stores the latest message and type', () => {
    useUIStore.getState().notify('saved!', 'success');
    const n = useUIStore.getState().notification;
    expect(n?.message).toBe('saved!');
    expect(n?.type).toBe('success');
  });

  it('opens the new-file dialog with a target path', () => {
    useUIStore.getState().openNewFileDialog('default/src/', true);
    expect(useUIStore.getState().newFileDialogOpen).toBe(true);
    expect(useUIStore.getState().newFilePath).toBe('default/src/');
    expect(useUIStore.getState().newFileIsDir).toBe(true);
  });
});
