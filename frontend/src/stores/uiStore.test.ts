import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidebarOpen: true,
    bottomOpen: true,
    bottomView: 'terminal',
    sidebarView: 'explorer',
    notification: null,
    pendingRun: null,
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

  it('openPreview opens the preview panel and sets the url', () => {
    useUIStore.setState({ previewOpen: false, previewUrl: '' });
    useUIStore.getState().openPreview('/api/files/raw/default/index.html');
    expect(useUIStore.getState().previewOpen).toBe(true);
    expect(useUIStore.getState().previewUrl).toBe('/api/files/raw/default/index.html');
  });

  it('runInTerminal queues a command and reveals the terminal', () => {
    useUIStore.setState({ bottomOpen: false, bottomView: 'logs', pendingRun: null });
    useUIStore.getState().runInTerminal('echo hi');
    const s = useUIStore.getState();
    expect(s.pendingRun?.command).toBe('echo hi');
    expect(s.bottomOpen).toBe(true);
    expect(s.bottomView).toBe('terminal');
  });

  it('runInTerminal assigns a fresh id each call (so identical commands re-run)', () => {
    useUIStore.getState().runInTerminal('python3 x.py');
    const first = useUIStore.getState().pendingRun!.id;
    useUIStore.getState().runInTerminal('python3 x.py');
    const second = useUIStore.getState().pendingRun!.id;
    expect(second).not.toBe(first);
  });

  it('clearPendingRun only clears the matching id', () => {
    useUIStore.getState().runInTerminal('first');
    const id = useUIStore.getState().pendingRun!.id;
    useUIStore.getState().clearPendingRun(id + 999);
    expect(useUIStore.getState().pendingRun).not.toBeNull();
    useUIStore.getState().clearPendingRun(id);
    expect(useUIStore.getState().pendingRun).toBeNull();
  });
});
