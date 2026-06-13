import { describe, it, expect } from 'vitest';
import { scoreMatch, getAllFiles } from './QuickOpenDialog';
import type { FileNode } from '../../types';

const file = (name: string, path: string): FileNode => ({ name, path, type: 'file' });

describe('scoreMatch', () => {
  it('ranks exact name match highest', () => {
    const exact = scoreMatch(file('app.py', 'src/app.py'), 'app.py');
    const prefix = scoreMatch(file('application.py', 'src/application.py'), 'app');
    const contains = scoreMatch(file('myapp.py', 'src/myapp.py'), 'app');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(contains);
  });

  it('returns 0 when the pattern cannot be matched', () => {
    expect(scoreMatch(file('readme.md', 'readme.md'), 'xyz')).toBe(0);
  });

  it('matches fuzzy subsequences in the name', () => {
    expect(scoreMatch(file('FileExplorer.tsx', 'src/FileExplorer.tsx'), 'fexp')).toBeGreaterThan(0);
  });

  it('treats empty pattern as a neutral match', () => {
    expect(scoreMatch(file('whatever.txt', 'whatever.txt'), '')).toBe(1);
  });
});

describe('getAllFiles', () => {
  const tree: FileNode = {
    name: 'default',
    path: 'default',
    type: 'directory',
    children: [
      { name: 'a.py', path: 'default/a.py', type: 'file' },
      {
        name: 'sub',
        path: 'default/sub',
        type: 'directory',
        children: [
          { name: 'b.ts', path: 'default/sub/b.ts', type: 'file' },
        ],
      },
    ],
  };

  it('flattens a tree into files only', () => {
    const files = getAllFiles(tree);
    const paths = files.map(f => f.path).sort();
    expect(paths).toEqual(['default/a.py', 'default/sub/b.ts']);
  });

  it('handles a null tree', () => {
    expect(getAllFiles(null)).toEqual([]);
  });
});
