import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LANGUAGE_MAP: Record<string, string> = {
  py:         'python',
  js:         'javascript',
  mjs:        'javascript',
  cjs:        'javascript',
  ts:         'typescript',
  tsx:        'typescript',
  jsx:        'javascript',
  html:       'html',
  htm:        'html',
  css:        'css',
  scss:       'scss',
  sass:       'scss',
  less:       'less',
  json:       'json',
  jsonc:      'json',
  md:         'markdown',
  markdown:   'markdown',
  mdx:        'markdown',
  yml:        'yaml',
  yaml:       'yaml',
  sql:        'sql',
  sh:         'shell',
  bash:       'shell',
  zsh:        'shell',
  fish:       'shell',
  txt:        'plaintext',
  xml:        'xml',
  svg:        'xml',
  java:       'java',
  cpp:        'cpp',
  cxx:        'cpp',
  cc:         'cpp',
  c:          'c',
  h:          'c',
  hpp:        'cpp',
  go:         'go',
  rs:         'rust',
  rb:         'ruby',
  php:        'php',
  swift:      'swift',
  kt:         'kotlin',
  kts:        'kotlin',
  scala:      'scala',
  r:          'r',
  lua:        'lua',
  vim:        'plaintext',
  toml:       'toml',
  ini:        'ini',
  cfg:        'ini',
  env:        'plaintext',
  dockerfile: 'dockerfile',
  makefile:   'makefile',
  proto:      'proto',
  graphql:    'graphql',
  gql:        'graphql',
  prisma:     'prisma',
};

export function getLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
  if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile';
  if (lower.startsWith('.env')) return 'plaintext';
  const ext = lower.split('.').pop() ?? '';
  return LANGUAGE_MAP[ext] ?? 'plaintext';
}

export const FILE_ICON_MAP: Record<string, string> = {
  py:         '🐍',
  js:         '📜',
  mjs:        '📜',
  ts:         '📘',
  tsx:        '⚛️',
  jsx:        '⚛️',
  html:       '🌐',
  css:        '🎨',
  scss:       '🎨',
  sass:       '🎨',
  json:       '📋',
  md:         '📝',
  sql:        '🗄️',
  sh:         '⚙️',
  bash:       '⚙️',
  yaml:       '⚙️',
  yml:        '⚙️',
  dockerfile: '🐳',
  go:         '🐹',
  rs:         '🦀',
  rb:         '💎',
  java:       '☕',
  cpp:        '⚡',
  c:          '⚡',
  txt:        '📄',
  xml:        '📄',
  toml:       '⚙️',
  ini:        '⚙️',
  lock:       '🔒',
  env:        '🔒',
  gitignore:  '👁️',
  proto:      '📡',
  graphql:    '🔗',
  svg:        '🖼️',
};

export function getFileIcon(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return '🐳';
  if (lower === '.gitignore') return '👁️';
  if (lower === 'license' || lower === 'license.md') return '⚖️';
  if (lower === 'readme.md' || lower === 'readme') return '📖';
  if (lower === 'package.json' || lower === 'package-lock.json') return '📦';
  if (lower.startsWith('.env')) return '🔒';
  const ext = lower.split('.').pop() ?? '';
  return FILE_ICON_MAP[ext] ?? '📄';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#4ec9b0';
    case 'stopped': return '#858585';
    case 'error':   return '#f44747';
    default:        return '#858585';
  }
}

export function formatRelativeTime(dateStr: string): string {
  const date  = new Date(dateStr);
  const now   = Date.now();
  const diff  = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60)          return 'just now';
  if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000)     return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}
