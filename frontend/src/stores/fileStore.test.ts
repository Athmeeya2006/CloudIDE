import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FileNode } from '../types';

vi.mock('../api/client', () => ({
  filesApi: {
    read: vi.fn(async (path: string) => ({ content: `content:${path}`, encoding: 'utf-8' })),
    write: vi.fn(async () => ({ status: 'saved' })),
    tree: vi.fn(async (workspace: string) => ({ name: workspace, path: workspace, type: 'directory', children: [] })),
    create: vi.fn(async () => ({ status: 'created' })),
    rename: vi.fn(async () => ({ status: 'renamed' })),
    delete: vi.fn(async () => ({ status: 'deleted' })),
    listWorkspaces: vi.fn(async () => ({ workspaces: ['default', 'project-a'] })),
    createWorkspace: vi.fn(async () => ({ status: 'created' })),
  },
}));

import { useFileStore } from './fileStore';

const f = (name: string): FileNode => ({ name, path: `default/${name}`, type: 'file' });

beforeEach(() => {
  useFileStore.setState({
    workspace: 'default',
    fileTree: null,
    openTabs: [],
    activeTabPath: null,
    loading: false,
    error: null,
  });
});

describe('fileStore', () => {
  it('opens a file as a new active tab', async () => {
    await useFileStore.getState().openFile(f('a.py'));
    const s = useFileStore.getState();
    expect(s.openTabs).toHaveLength(1);
    expect(s.activeTabPath).toBe('default/a.py');
    expect(s.openTabs[0].content).toBe('content:default/a.py');
    expect(s.openTabs[0].modified).toBe(false);
  });

  it('does not reopen an already open file, just activates it', async () => {
    await useFileStore.getState().openFile(f('a.py'));
    await useFileStore.getState().openFile(f('b.py'));
    await useFileStore.getState().openFile(f('a.py'));
    expect(useFileStore.getState().openTabs).toHaveLength(2);
    expect(useFileStore.getState().activeTabPath).toBe('default/a.py');
  });

  it('ignores directories', async () => {
    await useFileStore.getState().openFile({ name: 'dir', path: 'default/dir', type: 'directory' });
    expect(useFileStore.getState().openTabs).toHaveLength(0);
  });

  it('marks a tab modified on edit and clears it on save', async () => {
    await useFileStore.getState().openFile(f('a.py'));
    useFileStore.getState().updateContent('default/a.py', 'edited');
    expect(useFileStore.getState().openTabs[0].modified).toBe(true);
    expect(useFileStore.getState().openTabs[0].content).toBe('edited');
    await useFileStore.getState().saveFile('default/a.py');
    expect(useFileStore.getState().openTabs[0].modified).toBe(false);
  });

  it('closeTab activates an adjacent tab', async () => {
    await useFileStore.getState().openFile(f('a.py'));
    await useFileStore.getState().openFile(f('b.py'));
    await useFileStore.getState().openFile(f('c.py'));
    // active is c; closing it should fall back to b
    useFileStore.getState().closeTab('default/c.py');
    expect(useFileStore.getState().activeTabPath).toBe('default/b.py');
    // closing a non-active tab leaves the active one alone
    useFileStore.getState().closeTab('default/a.py');
    expect(useFileStore.getState().activeTabPath).toBe('default/b.py');
  });

  it('closing the last tab clears the active path', async () => {
    await useFileStore.getState().openFile(f('only.py'));
    useFileStore.getState().closeTab('default/only.py');
    expect(useFileStore.getState().openTabs).toHaveLength(0);
    expect(useFileStore.getState().activeTabPath).toBeNull();
  });

  it('renameFile updates the open tab path and name', async () => {
    await useFileStore.getState().openFile(f('old.py'));
    await useFileStore.getState().renameFile('default/old.py', 'default/new.py');
    const tab = useFileStore.getState().openTabs[0];
    expect(tab.path).toBe('default/new.py');
    expect(tab.name).toBe('new.py');
    expect(useFileStore.getState().activeTabPath).toBe('default/new.py');
  });

  it('setWorkspace switches workspace and clears open tabs', async () => {
    await useFileStore.getState().openFile(f('a.py'));
    expect(useFileStore.getState().openTabs).toHaveLength(1);
    await useFileStore.getState().setWorkspace('project-a');
    const s = useFileStore.getState();
    expect(s.workspace).toBe('project-a');
    expect(s.openTabs).toHaveLength(0);
    expect(s.activeTabPath).toBeNull();
    expect(s.fileTree?.name).toBe('project-a');
  });

  it('loadWorkspaces populates the workspace list', async () => {
    await useFileStore.getState().loadWorkspaces();
    expect(useFileStore.getState().workspaces).toContain('project-a');
  });
});
