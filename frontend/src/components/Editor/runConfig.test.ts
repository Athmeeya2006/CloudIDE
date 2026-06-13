import { describe, it, expect } from 'vitest';
import { getRunConfig, buildRunCommand } from './runConfig';

describe('getRunConfig', () => {
  it('resolves python', () => {
    const c = getRunConfig('default/main.py', 'default');
    expect(c?.command).toBe('python3 -u "main.py"');
    expect(c?.cwd).toBe('default');
  });

  it('resolves node for js/mjs/cjs', () => {
    expect(getRunConfig('default/a.js', 'default')?.command).toBe('node "a.js"');
    expect(getRunConfig('default/a.mjs', 'default')?.command).toBe('node "a.mjs"');
    expect(getRunConfig('default/a.cjs', 'default')?.command).toBe('node "a.cjs"');
  });

  it('compiles c and c++', () => {
    expect(getRunConfig('default/a.c', 'default')?.command).toContain('gcc -Wall');
    expect(getRunConfig('default/a.cpp', 'default')?.command).toContain('g++ -Wall');
    expect(getRunConfig('default/a.cc', 'default')?.command).toContain('g++ -Wall');
  });

  it('treats package.json specially', () => {
    expect(getRunConfig('default/app/package.json', 'default')?.command).toBe('npm run dev');
  });

  it('returns null for non-runnable files', () => {
    expect(getRunConfig('default/notes.md', 'default')).toBeNull();
    expect(getRunConfig('default/data.xyz', 'default')).toBeNull();
    expect(getRunConfig('default/noext', 'default')).toBeNull();
  });
});

describe('buildRunCommand', () => {
  it('cds into the workspace root for a top-level file', () => {
    expect(buildRunCommand('default/main.py', 'default')?.command)
      .toBe('cd "$WORKSPACE_DIR/." && python3 -u "main.py"');
  });

  it('cds into a subdirectory for a nested file', () => {
    expect(buildRunCommand('default/src/app.py', 'default')?.command)
      .toBe('cd "$WORKSPACE_DIR/src" && python3 -u "app.py"');
  });

  it('handles deep nesting and a non-default workspace', () => {
    expect(buildRunCommand('proj/a/b/main.js', 'proj')?.command)
      .toBe('cd "$WORKSPACE_DIR/a/b" && node "main.js"');
  });

  it('carries through the display name', () => {
    expect(buildRunCommand('default/main.py', 'default')?.displayName).toBe('Python: main.py');
  });

  it('returns null for non-runnable files', () => {
    expect(buildRunCommand('default/readme.md', 'default')).toBeNull();
  });
});
