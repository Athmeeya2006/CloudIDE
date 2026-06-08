import React, { useEffect, useState } from 'react';
import { Database, Table, Play, ArrowLeft, RefreshCw } from 'lucide-react';
import { dbApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { formatBytes, cn } from '../../utils';
import type { DbColumn } from '../../types';

interface DbFile { name: string; path: string; size: number }

export function DbViewerPanel() {
  const { workspace } = useFileStore();
  const { notify } = useUIStore();
  const [dbs, setDbs] = useState<DbFile[]>([]);
  const [activeDb, setActiveDb] = useState<DbFile | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  
  const [columns, setColumns] = useState<DbColumn[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [customSql, setCustomSql] = useState('');
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch databases in workspace
  const loadDbs = async () => {
    setLoading(true);
    try {
      const data = await dbApi.listDatabases(workspace);
      setDbs(data.databases);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDbs();
  }, [workspace]);

  // Load tables for active DB
  useEffect(() => {
    if (!activeDb) {
      setTables([]);
      setActiveTable(null);
      return;
    }
    dbApi.listTables(activeDb.path).then(res => setTables(res.tables));
  }, [activeDb]);

  // Load schema and data rows when active table changes or pagination changes
  useEffect(() => {
    if (!activeDb || !activeTable) {
      setColumns([]);
      setRows([]);
      setTotalRows(0);
      return;
    }

    setLoading(true);
    Promise.all([
      dbApi.schema(activeDb.path, activeTable),
      dbApi.rows(activeDb.path, activeTable, limit, offset)
    ]).then(([schemaData, rowData]) => {
      setColumns(schemaData.columns);
      setRows(rowData.rows);
      setTotalRows(rowData.total);
    }).catch(() => {
      notify('Failed to load table data', 'error');
    }).finally(() => {
      setLoading(false);
    });
  }, [activeDb, activeTable, offset]);

  // Run a custom read-only SQL query
  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDb || !customSql.trim()) return;

    setLoading(true);
    try {
      const data = await dbApi.query(activeDb.path, customSql);
      setQueryResult({
        columns: data.columns,
        rows: data.rows,
      });
      notify('Query executed successfully', 'success');
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Query failed', 'error');
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  };

  if (!activeDb) {
    return (
      <div className="h-full flex flex-col p-4 bg-ide-terminal overflow-y-auto">
        <div className="flex items-center justify-between mb-4 border-b border-ide-border pb-2">
          <h3 className="text-xs font-semibold tracking-wider text-ide-text-muted uppercase">Select Database</h3>
          <button onClick={loadDbs} className="p-1 hover:text-white text-ide-text-dim transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        {dbs.length === 0 ? (
          <div className="text-center py-8 text-ide-text-dim text-xs">
            No SQLite databases (.db, .sqlite, .sqlite3) found in this workspace.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dbs.map(db => (
              <div
                key={db.path}
                onClick={() => setActiveDb(db)}
                className="bg-ide-bg-light border border-ide-border rounded p-3 hover:border-ide-accent cursor-pointer transition-colors flex items-start gap-3"
              >
                <Database className="text-ide-yellow mt-0.5 shrink-0" size={18} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ide-text truncate">{db.name}</div>
                  <div className="text-[10px] text-ide-text-dim mt-0.5 font-mono truncate">{db.path}</div>
                  <div className="text-[10px] text-ide-text-dim mt-1">{formatBytes(db.size)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden bg-ide-terminal select-text">
      {/* Tables Sidebar */}
      <div className="w-56 border-r border-ide-border flex flex-col shrink-0">
        <div className="p-2 border-b border-ide-border flex items-center justify-between bg-ide-bg-light shrink-0">
          <button
            onClick={() => { setActiveDb(null); setQueryResult(null); }}
            className="flex items-center gap-1 text-[11px] text-ide-text-dim hover:text-ide-text"
          >
            <ArrowLeft size={11} /> Databases
          </button>
          <span className="text-[10px] font-mono text-ide-text-muted truncate max-w-[100px]" title={activeDb.name}>
            {activeDb.name}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-1">
          {tables.length === 0 ? (
            <div className="text-center py-4 text-ide-text-dim text-[11px]">No tables</div>
          ) : (
            tables.map(table => (
              <button
                key={table}
                onClick={() => { setActiveTable(table); setOffset(0); setQueryResult(null); }}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-ide-hover transition-colors text-[12px] truncate',
                  activeTable === table ? 'bg-[#2d2d2d] text-ide-text' : 'text-ide-text-muted'
                )}
              >
                <Table size={12} className="text-ide-accent shrink-0" />
                <span className="truncate">{table}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* SQL Query Runner Input */}
        <div className="p-3 border-b border-ide-border bg-ide-bg-light shrink-0">
          <form onSubmit={handleQuery} className="flex gap-2">
            <input
              value={customSql}
              onChange={e => setCustomSql(e.target.value)}
              placeholder="SELECT * FROM table LIMIT 10"
              className="flex-1 bg-ide-bg text-ide-text font-mono text-[12px] px-3 py-1.5 outline-none border border-ide-border focus:border-ide-accent"
            />
            <button
              type="submit"
              disabled={!customSql.trim() || loading}
              className="px-3 bg-ide-accent hover:bg-[#1a8ad4] text-white text-[12px] font-medium flex items-center gap-1.5 rounded transition-colors disabled:opacity-40"
            >
              <Play size={12} fill="currentColor" /> Run Query
            </button>
          </form>
        </div>

        {/* Query Results / Table Data Area */}
        <div className="flex-1 overflow-auto bg-ide-bg">
          {queryResult ? (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2 text-[11px] text-ide-text-muted">
                <span>Query Results ({queryResult.rows.length} rows)</span>
                <button
                  onClick={() => setQueryResult(null)}
                  className="hover:text-ide-text underline"
                >
                  Back to table view
                </button>
              </div>
              <div className="overflow-x-auto border border-ide-border rounded">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead className="bg-ide-bg-light border-b border-ide-border">
                    <tr>
                      {queryResult.columns.map(col => (
                        <th key={col} className="px-3 py-2 text-ide-text-muted border-r border-ide-border font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr key={i} className="border-b border-ide-border hover:bg-white/5">
                        {queryResult.columns.map(col => (
                          <td key={col} className="px-3 py-1.5 border-r border-ide-border truncate max-w-[200px]" title={String(row[col] ?? '')}>
                            {row[col] === null ? <span className="text-ide-text-dim italic">null</span> : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTable ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Pagination Toolbar */}
              <div className="h-8 px-3 border-b border-ide-border flex items-center justify-between text-[11px] text-ide-text-dim bg-ide-bg-light shrink-0">
                <span>Showing rows {offset + 1} - {Math.min(offset + limit, totalRows)} of {totalRows}</span>
                <div className="flex gap-1">
                  <button
                    disabled={offset === 0}
                    onClick={() => setOffset(o => Math.max(0, o - limit))}
                    className="px-2 py-0.5 bg-ide-bg border border-ide-border hover:border-ide-accent text-ide-text disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={offset + limit >= totalRows}
                    onClick={() => setOffset(o => o + limit)}
                    className="px-2 py-0.5 bg-ide-bg border border-ide-border hover:border-ide-accent text-ide-text disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto p-3">
                <table className="w-full text-[11px] text-left border-collapse font-mono border border-ide-border">
                  <thead className="bg-[#2d2d2d] border-b border-ide-border sticky top-0">
                    <tr>
                      {columns.map(col => (
                        <th key={col.name} className="px-3 py-2 text-ide-text-muted border-r border-ide-border font-medium">
                          <div className="flex flex-col">
                            <span>{col.name} {col.pk === 1 && '🔑'}</span>
                            <span className="text-[9px] font-normal text-ide-text-dim">{col.type}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-ide-border hover:bg-white/5">
                        {columns.map(col => (
                          <td key={col.name} className="px-3 py-1.5 border-r border-ide-border truncate max-w-[200px]" title={String(row[col.name] ?? '')}>
                            {row[col.name] === null ? <span className="text-ide-text-dim italic">null</span> : String(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-ide-text-dim text-xs">
              Select a table from the sidebar to inspect its records or execute custom SQL queries.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
