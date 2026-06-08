import { useState, useEffect } from 'react';
import { Database, ChevronRight } from 'lucide-react';
import { dbApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';

interface DbFile { name: string; path: string; size: number }

export function DatabasePanel() {
  const { workspace } = useFileStore();
  const { openBottom } = useUIStore();
  const [dbs, setDbs] = useState<DbFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    dbApi.listDatabases(workspace).then(d => setDbs(d.databases)).finally(() => setLoading(false));
  }, [workspace]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[11px] font-semibold tracking-widest text-ide-text-muted uppercase border-b border-ide-border">
        Databases
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="text-ide-text-dim text-xs px-4 py-4">Scanning...</div>
        ) : dbs.length === 0 ? (
          <div className="text-ide-text-dim text-xs px-4 py-4">
            No SQLite databases found in workspace.
            <br /><br />
            Run migrations to create one.
          </div>
        ) : (
          dbs.map(db => (
            <button
              key={db.path}
              onClick={() => openBottom('db-viewer')}
              className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-ide-hover text-ide-text"
            >
              <Database size={14} className="text-ide-yellow shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate">{db.name}</div>
                <div className="text-[11px] text-ide-text-dim">{(db.size / 1024).toFixed(1)} KB</div>
              </div>
              <ChevronRight size={12} className="text-ide-text-dim shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
