import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, CaseSensitive, Loader2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { filesApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { getFileIcon, cn, getErrorMessage } from '../../utils';
import type { GrepResult } from '../../types';
 
type SearchMode = 'filename' | 'content';
 
interface GroupedResult {
  path: string;
  name: string;
  matches: GrepResult[];
}
 
function groupResults(results: GrepResult[]): GroupedResult[] {
  const map = new Map<string, GroupedResult>();
  for (const r of results) {
    if (!map.has(r.path)) {
      map.set(r.path, { path: r.path, name: r.name, matches: [] });
    }
    map.get(r.path)!.matches.push(r);
  }
  return Array.from(map.values());
}
 
function MatchLine({ content, query }: { content: string; query: string }) {
  const trimmed = content.trimStart();
  const indent = content.length - trimmed.length;
  const q = query.toLowerCase();
  const idx = trimmed.toLowerCase().indexOf(q);
 
  if (idx < 0) return <span className="text-ide-text-muted">{trimmed}</span>;
 
  return (
    <span className="text-ide-text-muted">
      {' '.repeat(Math.min(indent, 4))}
      {trimmed.slice(0, idx)}
      <mark className="bg-yellow-500/30 text-yellow-200 not-italic">{trimmed.slice(idx, idx + q.length)}</mark>
      {trimmed.slice(idx + q.length)}
    </span>
  );
}
 
export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('content');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GrepResult[] | string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const { workspace, openFile } = useFileStore();
  const { notify } = useUIStore();
  const inputRef = useRef<HTMLInputElement>(null);
 
  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setResults([]);
    setTruncated(false);
    setExpanded(new Set());
 
    try {
      if (mode === 'content') {
        const data = await filesApi.grep(q, workspace, caseSensitive);
        setResults(data.results ?? []);
        setTruncated(data.truncated ?? false);
        // Auto-expand all groups for small result sets
        if ((data.results ?? []).length <= 50) {
          const paths = new Set<string>((data.results as GrepResult[]).map((r: GrepResult) => r.path));
          setExpanded(paths);
        }
      } else {
        const data = await filesApi.search(q, workspace);
        setResults(data.results ?? []);
      }
    } catch (e: unknown) {
      notify(getErrorMessage(e, 'Search failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [query, mode, workspace, caseSensitive, notify]);
 
  // Reset results when switching modes so a content/filename result shape
  // mismatch can never be rendered.
  useEffect(() => {
    setResults([]);
    setSearched(false);
    setTruncated(false);
    setExpanded(new Set());
  }, [mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };
 
  const toggleGroup = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };
 
  const clear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };
 
  const isGrepResults = mode === 'content';
  const grepGroups = isGrepResults ? groupResults(results as GrepResult[]) : [];
  const filenameResults = !isGrepResults ? (results as string[]) : [];
 
  const totalMatches = isGrepResults
    ? (results as GrepResult[]).length
    : filenameResults.length;
 
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-semibold tracking-widest text-ide-text-muted uppercase border-b border-ide-border shrink-0">
        Search
      </div>
 
      {/* Controls */}
      <div className="p-2.5 border-b border-ide-border bg-[#252526] shrink-0 space-y-2">
        {/* Mode toggle */}
        <div className="flex rounded overflow-hidden border border-ide-border text-[11px]">
          {(['content', 'filename'] as SearchMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 py-1 capitalize transition-colors',
                mode === m
                  ? 'bg-ide-accent text-white'
                  : 'text-ide-text-muted hover:text-ide-text hover:bg-ide-hover',
              )}
            >
              {m === 'content' ? 'Content' : 'Filename'}
            </button>
          ))}
        </div>
 
        {/* Search input */}
        <div className="flex items-center gap-1">
          <div className="flex-1 flex items-center bg-ide-bg border border-ide-border focus-within:border-ide-accent gap-1 px-2 py-1">
            <Search size={12} className="text-ide-text-dim shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'content' ? 'Search in files…' : 'Search filenames…'}
              className="flex-1 bg-transparent text-ide-text text-[12px] outline-none placeholder:text-ide-text-dim"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button onClick={clear} className="text-ide-text-dim hover:text-ide-text p-0.5">
                <X size={11} />
              </button>
            )}
          </div>
 
          {mode === 'content' && (
            <button
              onClick={() => setCaseSensitive(v => !v)}
              title="Case Sensitive"
              className={cn(
                'p-1.5 border rounded transition-colors',
                caseSensitive
                  ? 'border-ide-accent text-ide-accent bg-ide-accent/10'
                  : 'border-ide-border text-ide-text-dim hover:text-ide-text hover:border-ide-text-dim',
              )}
            >
              <CaseSensitive size={13} />
            </button>
          )}
 
          <button
            onClick={doSearch}
            disabled={loading || !query.trim()}
            className="p-1.5 bg-ide-accent hover:bg-[#1a8ad4] disabled:opacity-40 text-white rounded transition-colors"
          >
            {loading
              ? <Loader2 size={13} className="animate-spin" />
              : <Search size={13} />}
          </button>
        </div>
      </div>
 
      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-ide-text-dim text-[12px]">
            <Loader2 size={16} className="animate-spin text-ide-accent" />
            Searching…
          </div>
        ) : searched && totalMatches === 0 ? (
          <div className="px-4 py-10 text-center text-ide-text-dim text-[12px]">
            No results for <span className="text-ide-text">&ldquo;{query}&rdquo;</span>
          </div>
        ) : searched && isGrepResults ? (
          <>
            {truncated && (
              <div className="px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 text-[11px] text-yellow-300">
                Results limited. Refine your search for more
              </div>
            )}
            <div className="px-3 py-1.5 text-[10px] text-ide-text-dim border-b border-ide-border/40">
              {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {grepGroups.length} file{grepGroups.length !== 1 ? 's' : ''}
            </div>
            {grepGroups.map(group => {
              const isOpen = expanded.has(group.path);
              return (
                <div key={group.path} className="border-b border-ide-border/30">
                  {/* File header */}
                  <button
                    onClick={() => toggleGroup(group.path)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-ide-hover text-left group transition-colors"
                  >
                    <span className="shrink-0 text-ide-text-dim w-3">
                      {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                    <span className="text-[13px]">{getFileIcon(group.name)}</span>
                    <span className="text-[12px] text-ide-text truncate flex-1">{group.name}</span>
                    <span className="text-[10px] text-ide-accent bg-ide-accent/10 px-1.5 py-0.5 rounded shrink-0">
                      {group.matches.length}
                    </span>
                  </button>
 
                  {/* Match lines */}
                  {isOpen && (
                    <div className="bg-[#1a1a1a] pb-1">
                      {group.matches.map((m, i) => (
                        <button
                          key={i}
                          onClick={() => openFile({ name: group.name, path: group.path, type: 'file' })}
                          className="w-full text-left flex items-start gap-2 px-3 py-1 hover:bg-ide-hover group/match transition-colors"
                        >
                          <span className="text-[10px] text-ide-accent font-mono w-8 shrink-0 pt-0.5">
                            {m.line}
                          </span>
                          <span className="text-[11px] font-mono truncate">
                            <MatchLine content={m.content} query={query} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : searched && !isGrepResults ? (
          <>
            <div className="px-3 py-1.5 text-[10px] text-ide-text-dim border-b border-ide-border/40">
              {filenameResults.length} file{filenameResults.length !== 1 ? 's' : ''}
            </div>
            {filenameResults.map(path => {
              const name = path.split('/').pop() ?? path;
              return (
                <button
                  key={path}
                  onClick={() => openFile({ name, path, type: 'file' })}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-ide-hover transition-colors"
                >
                  <span className="text-[14px] shrink-0">{getFileIcon(name)}</span>
                  <div className="min-w-0">
                    <div className="text-[12px] text-ide-text truncate">{name}</div>
                    <div className="text-[10px] text-ide-text-dim truncate">{path}</div>
                  </div>
                </button>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-ide-text-dim text-[12px] gap-2">
            <Search size={24} className="opacity-20" />
            <p>Search across all workspace files</p>
            <p className="text-[11px] opacity-60">Press Enter or click the search button</p>
          </div>
        )}
      </div>
    </div>
  );
}
