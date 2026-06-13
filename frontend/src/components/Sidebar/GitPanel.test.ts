import { describe, it, expect } from 'vitest';
import { parseDiff } from './GitPanel';

describe('parseDiff', () => {
  const diff = [
    'diff --git a/x.txt b/x.txt',
    'index 1111111..2222222 100644',
    '--- a/x.txt',
    '+++ b/x.txt',
    '@@ -1,2 +1,2 @@',
    ' unchanged line',
    '-old line',
    '+new line',
  ].join('\n');

  it('classifies each diff line by type', () => {
    const lines = parseDiff(diff);
    const types = lines.map(l => l.type);
    expect(types).toContain('meta');
    expect(types).toContain('hunk');
    expect(types).toContain('context');
    expect(types).toContain('add');
    expect(types).toContain('del');
  });

  it('treats +++/--- headers as meta, not add/del', () => {
    const lines = parseDiff(diff);
    expect(lines.find(l => l.content === '+++ b/x.txt')?.type).toBe('meta');
    expect(lines.find(l => l.content === '--- a/x.txt')?.type).toBe('meta');
    expect(lines.find(l => l.content === '+new line')?.type).toBe('add');
    expect(lines.find(l => l.content === '-old line')?.type).toBe('del');
  });

  it('handles empty input', () => {
    expect(parseDiff('')).toEqual([{ type: 'context', content: '' }]);
  });
});
