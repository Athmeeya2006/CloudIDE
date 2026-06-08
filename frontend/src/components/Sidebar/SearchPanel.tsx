import { useState } from 'react';
import { Search } from 'lucide-react';
import { filesApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { getFileIcon } from '../../utils';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { workspace, openFile } = useFileStore();

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await filesApi.search(query, workspace);
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[11px] font-semibold tracking-widest text-ide-text-muted uppercase border-b border-ide-border shrink-0">
        Search
      </div>
      <div className="p-2 border-b border-ide-border">
        <div className="flex gap-1">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search files..."
            className="flex-1 bg-ide-bg-lighter text-ide-text text-[13px] px-2 py-1 outline-none border border-ide-border focus:border-ide-accent placeholder:text-ide-text-dim"
          />
          <button onClick={doSearch} className="px-2 bg-ide-bg-lighter border border-ide-border hover:border-ide-accent text-ide-text-muted hover:text-ide-text transition-colors">
            <Search size={13} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-ide-text-dim text-xs px-4 py-4">Searching...</div>
        ) : results.length > 0 ? (
          results.map(path => (
            <button
              key={path}
              onClick={() => openFile({ name: path.split('/').pop()!, path, type: 'file' })}
              className="w-full text-left px-3 py-1 text-[13px] hover:bg-ide-hover truncate text-ide-text"
            >
              {getFileIcon(path.split('/').pop()!)} {path}
            </button>
          ))
        ) : query ? (
          <div className="text-ide-text-dim text-xs px-4 py-4">No results for &ldquo;{query}&rdquo;</div>
        ) : null}
      </div>
    </div>
  );
}
