import { describe, it, expect } from 'vitest';
import {
  getLanguage,
  getFileIcon,
  formatBytes,
  getStatusColor,
  formatRelativeTime,
  cn,
} from './index';

describe('getLanguage', () => {
  it('maps common extensions', () => {
    expect(getLanguage('main.py')).toBe('python');
    expect(getLanguage('app.tsx')).toBe('typescript');
    expect(getLanguage('index.js')).toBe('javascript');
    expect(getLanguage('styles.scss')).toBe('scss');
    expect(getLanguage('data.json')).toBe('json');
  });

  it('handles special filenames', () => {
    expect(getLanguage('Dockerfile')).toBe('dockerfile');
    expect(getLanguage('dockerfile.dev')).toBe('dockerfile');
    expect(getLanguage('Makefile')).toBe('makefile');
    expect(getLanguage('.env')).toBe('plaintext');
    expect(getLanguage('.env.production')).toBe('plaintext');
  });

  it('falls back to plaintext for unknown extensions', () => {
    expect(getLanguage('notes.unknownext')).toBe('plaintext');
    expect(getLanguage('noextension')).toBe('plaintext');
  });
});

describe('getFileIcon', () => {
  it('returns specific icons for known files', () => {
    expect(getFileIcon('README.md')).toBe('📖');
    expect(getFileIcon('package.json')).toBe('📦');
    expect(getFileIcon('Dockerfile')).toBe('🐳');
    expect(getFileIcon('.gitignore')).toBe('👁️');
  });
  it('falls back to a default icon', () => {
    expect(getFileIcon('mystery.zzz')).toBe('📄');
  });
});

describe('formatBytes', () => {
  it('formats across unit boundaries', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('getStatusColor', () => {
  it('maps process states to colors', () => {
    expect(getStatusColor('running')).toBe('#4ec9b0');
    expect(getStatusColor('error')).toBe('#f44747');
    expect(getStatusColor('stopped')).toBe('#858585');
    expect(getStatusColor('anything-else')).toBe('#858585');
  });
});

describe('formatRelativeTime', () => {
  it('describes recent timestamps', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatRelativeTime(tenMinAgo)).toBe('10m ago');
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });
});

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});
