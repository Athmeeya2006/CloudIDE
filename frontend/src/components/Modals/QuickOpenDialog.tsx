import { useState, useEffect, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Clock } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useFileStore } from '../../stores/fileStore';
import { getFileIcon, cn } from '../../utils';
import type { FileNode } from '../../types';

export function getAllFiles(node: FileNode | null, results: FileNode[] = []): FileNode[] {
  if (!node) return results;
  if (node.type === 'file') results.push(node);
  else if (node.children) node.children.forEach(c => getAllFiles(c, results));
  return results;
}

interface MatchResult {
  file: FileNode;
  score: number;
  nameMatch: boolean;
}

export function scoreMatch(file: FileNode, pattern: string): number {
  if (!pattern) return 1;
  const p = pattern.toLowerCase();
  const name = file.name.toLowerCase();
  const path = file.path.toLowerCase();

  // Exact name match
  if (name === p) return 10000;
  // Exact path segment
  if (name.startsWith(p)) return 5000 - name.length;
  // Contains in name
  if (name.includes(p)) return 2000 - name.length;
  // Contains in path
  if (path.includes(p)) return 1000 - path.length;

  // Fuzzy match against name
  let score = 0;
  let pi = 0;
  let consecutive = 0;
  for (let si = 0; si < name.length && pi < p.length; si++) {
    if (name[si] === p[pi]) {
      consecutive++;
      score += consecutive * 5;
      // Bonus for word boundaries
      if (si === 0 || name[si - 1] === '/' || name[si - 1] === '.' || name[si - 1] === '-' || name[si - 1] === '_') {
        score += 10;
      }
      pi++;
    } else {
      consecutive = 0;
    }
  }
  if (pi < p.length) return 0; // pattern not fully matched in name

  return score;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const p = query.toLowerCase();
  const t = text.toLowerCase();
  const idx = t.indexOf(p);
  if (idx >= 0) {
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-ide-accent font-semibold">{text.slice(idx, idx + p.length)}</span>
        {text.slice(idx + p.length)}
      </>
    );
  }
  return <>{text}</>;
}

export function QuickOpenDialog() {
  const { quickOpenOpen, closeQuickOpen } = useUIStore();
  const { fileTree, openFile, openTabs } = useFileStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allFiles = getAllFiles(fileTree);

  // Recent files first when no query
  const recentPaths = openTabs.map(t => t.path);

  const filtered: MatchResult[] = query
    ? allFiles
        .map(f => ({ file: f, score: scoreMatch(f, query), nameMatch: f.name.toLowerCase().includes(query.toLowerCase()) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
    : [
        ...openTabs.map(t => ({ file: { name: t.name, path: t.path, type: 'file' as const }, score: 9999, nameMatch: true })),
        ...allFiles
          .filter(f => !recentPaths.includes(f.path))
          .slice(0, 25 - openTabs.length)
          .map(f => ({ file: f, score: 1, nameMatch: true })),
      ].slice(0, 25);

  useEffect(() => {
    if (quickOpenOpen) {
      setQuery('');
      setSelected(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [quickOpenOpen]);

  useEffect(() => { setSelected(0); }, [query]);

  const handleSelect = useCallback((file: FileNode) => {
    openFile(file);
    closeQuickOpen();
  }, [openFile, closeQuickOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelected(s => Math.min(s + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelected(s => Math.max(s - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selected]) handleSelect(filtered[selected].file);
        break;
      case 'Escape':
        e.preventDefault();
        closeQuickOpen();
        break;
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const item = container.children[selected] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const isRecent = (path: string) => recentPaths.includes(path);

  return (
    <Dialog.Root open={quickOpenOpen} onOpenChange={v => !v && closeQuickOpen()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[200] animate-fade-in" />
        <Dialog.Content
          className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[201] w-[600px] max-w-[95vw] bg-[#1e1e1e] border border-ide-border shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slide-in overflow-hidden"
          aria-label="Quick Open"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-ide-border bg-[#252526]">
            <Search size={15} className="text-ide-text-muted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Go to file…"
              className="flex-1 bg-transparent text-ide-text text-[14px] outline-none placeholder:text-ide-text-dim"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-ide-text-dim hover:text-ide-text">
                <X size={13} />
              </button>
            )}
            <kbd className="text-[10px] text-ide-text-dim border border-ide-border px-1.5 py-0.5 shrink-0">Esc</kbd>
          </div>

          {/* Results list */}
          <div ref={listRef} className="max-h-[380px] overflow-y-auto">
            {!query && openTabs.length > 0 && (
              <div className="px-4 py-1.5 text-[10px] font-semibold text-ide-text-dim uppercase tracking-widest">
                Recently Opened
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-ide-text-dim text-[13px]">
                No files match <span className="text-ide-text">&ldquo;{query}&rdquo;</span>
              </div>
            ) : (
              filtered.map(({ file }, i) => {
                const parts = file.path.split('/');
                const dir = parts.slice(0, -1).join('/');
                return (
                  <div
                    key={file.path}
                    onClick={() => handleSelect(file)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors group',
                      i === selected
                        ? 'bg-[#094771]'
                        : 'hover:bg-[#2a2d2e]',
                    )}
                  >
                    <span className="text-[15px] shrink-0">{getFileIcon(file.name)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-ide-text font-medium">
                          <HighlightMatch text={file.name} query={query} />
                        </span>
                        {isRecent(file.path) && (
                          <Clock size={10} className="text-ide-text-dim shrink-0" />
                        )}
                      </div>
                      {dir && (
                        <div className="text-[11px] text-ide-text-dim truncate">
                          <HighlightMatch text={dir} query={query} />
                        </div>
                      )}
                    </div>
                    {i === selected && (
                      <kbd className="text-[10px] text-ide-text-dim border border-ide-border px-1 py-0.5 shrink-0 opacity-60">↵</kbd>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-ide-border bg-[#252526] text-[11px] text-ide-text-dim">
            <span><kbd className="text-ide-accent">↑↓</kbd> navigate</span>
            <span><kbd className="text-ide-accent">↵</kbd> open</span>
            <span><kbd className="text-ide-accent">Esc</kbd> close</span>
            <span className="ml-auto">{filtered.length} {filtered.length === 1 ? 'file' : 'files'}</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
