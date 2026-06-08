import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LANGUAGE_MAP: Record<string, string> = {
  py: 'python', js: 'javascript', ts: 'typescript',
  tsx: 'typescript', jsx: 'javascript', html: 'html',
  css: 'css', scss: 'scss', less: 'less',
  json: 'json', md: 'markdown', markdown: 'markdown',
  yml: 'yaml', yaml: 'yaml', sql: 'sql',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  txt: 'plaintext', xml: 'xml', java: 'java',
  cpp: 'cpp', c: 'c', go: 'go', rs: 'rust',
  rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', scala: 'scala', r: 'r',
  dockerfile: 'dockerfile', toml: 'toml', ini: 'ini',
};

export function getLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  if (lower.startsWith('.env')) return 'plaintext';
  const ext = lower.split('.').pop() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

export const FILE_ICON_MAP: Record<string, string> = {
  py: '🐍', js: '📜', ts: '📘', tsx: '⚛️', jsx: '⚛️',
  html: '🌐', css: '🎨', scss: '🎨', json: '📋',
  md: '📝', sql: '🗄️', sh: '⚙️', yaml: '⚙️', yml: '⚙️',
  dockerfile: '🐳', env: '🔒', gitignore: '👁️',
  java: '☕', go: '🐹', rs: '🦀', rb: '💎',
  txt: '📄', xml: '📄', toml: '📄',
};

export function getFileIcon(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return '🐳';
  if (lower === '.gitignore') return '👁️';
  if (lower.startsWith('.env')) return '🔒';
  const ext = lower.split('.').pop() || '';
  return FILE_ICON_MAP[ext] || '📄';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#4ec9b0';
    case 'stopped': return '#858585';
    case 'error': return '#f44747';
    default: return '#858585';
  }
}
