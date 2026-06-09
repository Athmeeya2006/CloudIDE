import { useState, useEffect } from 'react';
import { Database, Table, RefreshCw, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { dbApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils';
import type { DbColumn } from '../../types';

interface DbFile { name: string; path: string; size: number }

export function DatabaseViewer() {
  const { workspace } = useFileStore();
  const { notify } = useUIStore();

  const [dbs, setDbs] = useState<DbFile[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [schema, setSchema] = useState<DbColumn[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<{ cols: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [queryError, setQueryError] = useState('');
  const [view, setView] = useState<'data' | 'schema' | 'query'>('data');
  const [loading, setLoading] = useState(false);

  // Load databases
  useEffect(() => {
    dbApi.listDatabases(workspace).then(d => {
      setDbs(d.databases);
      if (d.databases.length > 0 && !selectedDb) {
        setSelectedDb(d.databases[0].path);
      }
    });
  }, [workspace]);

  // Load tables when DB selected
  useEffect(() => {
    if (!selectedDb) return;
    setLoading(true);
    dbApi.listTables(selectedDb)
      .then(d => {
        setTables(d.tables);
        setSelectedTable(d.tables[0] ?? null);
      })
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, [selectedDb]);

  // Load schema + rows when table selected
  useEffect(() => {
    if (!selectedDb || !selectedTable) return;
    setPage(0);
    setLoading(true);
    Promise.all([
      dbApi.schema(selectedDb, selectedTable),
      dbApi.rows(selectedDb, selectedTable, PAGE_SIZE, 0),
    ]).then(([sch, r]) => {
      setSchema(sch.columns);
      setRows(r.rows);
      setColumns(r.rows.length > 0 ? Object.keys(r.rows[0]) : sch.columns.map((c: DbColumn) => c.name));
      setTotal(r.total);
    }).finally(() => setLoading(false));
  }, [selectedDb, selectedTable]);

  const loadPage = async (p: number) => {
    if (!selectedDb || !selectedTable) return;
    const r = await dbApi.rows(selectedDb, selectedTable, PAGE_SIZE, p * PAGE_SIZE);
    setRows(r.rows);
    setPage(p);
  };

  const runQuery = async () => {
    if (!selectedDb || !query.trim()) return;
    setQueryError('');
    setQueryResult(null);
    try {
      const r = await dbApi.query(selectedDb, query);
      setQueryResult({ cols: r.columns, rows: r.rows });
    } catch (e: any) {
      setQueryError(e.response?.data?.detail || e.message);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: DB + Table list */}
      <div className="w-52 border-r border-ide-border flex flex-col bg-[#252526] shrink-0">
        {/* DB selector */}
        <div className="px-2 py-1.5 border-b border-ide-border">
          <select
            value={selectedDb || ''}
            onChange={e => setSelectedDb(e.target.value)}
            className="w-full bg-ide-bg text-ide-text text-[12px] px-1.5 py-1 border border-ide-border focus:border-ide-accent outline-none"
          >
            {dbs.length === 0 && <option value="">No databases found</option>}
            {dbs.map(d => (
              <option key={d.path} value={d.path}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-y-auto py-1">
          <div className="px-2 py-1 text-[10px] text-ide-text-dim uppercase tracking-wider">Tables</div>
          {loading ? (
            <div className="px-3 py-2 text-[12px] text-ide-text-dim">Loading...</div>
          ) : tables.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-ide-text-dim">No tables</div>
          ) : (
            tables.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTable(t)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors',
                  selectedTable === t
                    ? 'bg-ide-selected text-ide-text'
                    : 'text-ide-text-muted hover:bg-ide-hover hover:text-ide-text',
                )}
              >
                <Table size={12} className="shrink-0 text-ide-yellow" />
                <span className="truncate">{t}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Data / Schema / Query */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-tabs */}
        <div className="flex items-center bg-[#252526] border-b border-ide-border shrink-0 h-8">
          {(['data', 'schema', 'query'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 h-8 text-[12px] capitalize transition-colors border-r border-ide-border',
                view === v ? 'bg-ide-bg text-ide-text' : 'text-ide-text-muted hover:text-ide-text',
              )}
            >
              {v}
            </button>
          ))}
          <div className="flex-1" />
          {selectedTable && (
            <span className="px-3 text-[11px] text-ide-text-dim font-mono">
              {selectedTable} ({total} rows)
            </span>
          )}
          <button
            onClick={() => selectedTable && loadPage(page)}
            className="px-2 text-ide-text-dim hover:text-ide-text"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'data' && (
            <>
              <div className="flex-1 overflow-auto">
                {rows.length === 0 ? (
                  <div className="p-4 text-ide-text-dim text-[13px]">
                    {selectedTable ? 'No rows in this table.' : 'Select a table.'}
                  </div>
                ) : (
                  <DataTable columns={columns} rows={rows} />
                )}
              </div>
              {total > PAGE_SIZE && (
                <Pagination page={page} total={totalPages} onPage={loadPage} />
              )}
            </>
          )}

          {view === 'schema' && (
            <div className="overflow-auto flex-1">
              {schema.length === 0 ? (
                <div className="p-4 text-ide-text-dim text-[13px]">Select a table.</div>
              ) : (
                <SchemaTable schema={schema} />
              )}
            </div>
          )}

          {view === 'query' && (
            <QueryRunner
              dbPath={selectedDb}
              result={queryResult}
              error={queryError}
              query={query}
              onQueryChange={setQuery}
              onRun={runQuery}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function DataTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return (
    <table className="w-full text-[12px] font-mono border-collapse">
      <thead className="sticky top-0 bg-[#252526] z-10">
        <tr>
          {columns.map(col => (
            <th key={col} className="text-left px-3 py-1.5 text-ide-text-muted border-b border-r border-ide-border font-normal tracking-wide whitespace-nowrap">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={cn('hover:bg-ide-hover', i % 2 === 0 ? 'bg-ide-bg' : 'bg-[#1e1e1e]')}>
            {columns.map(col => (
              <td key={col} className="px-3 py-1 border-b border-r border-[#2d2d2d] text-ide-text whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                <CellValue value={row[col]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-ide-text-dim italic">NULL</span>;
  if (typeof value === 'boolean')
    return <span className={value ? 'text-ide-green' : 'text-ide-red'}>{String(value)}</span>;
  if (typeof value === 'number')
    return <span className="text-[#b5cea8]">{String(value)}</span>;
  const str = String(value);
  if (str.length > 80) return <span title={str}>{str.slice(0, 80)}…</span>;
  return <>{str}</>;
}

function SchemaTable({ schema }: { schema: DbColumn[] }) {
  return (
    <table className="w-full text-[12px] font-mono">
      <thead className="sticky top-0 bg-[#252526]">
        <tr>
          {['#', 'Name', 'Type', 'Not Null', 'Default', 'PK'].map(h => (
            <th key={h} className="text-left px-3 py-1.5 text-ide-text-muted border-b border-r border-ide-border font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {schema.map(col => (
          <tr key={col.cid} className="hover:bg-ide-hover border-b border-[#2d2d2d]">
            <td className="px-3 py-1 text-ide-text-dim">{col.cid}</td>
            <td className="px-3 py-1 text-[#9cdcfe] font-medium">{col.name}</td>
            <td className="px-3 py-1 text-[#4ec9b0]">{col.type}</td>
            <td className="px-3 py-1">{col.notnull ? <span className="text-ide-red">YES</span> : <span className="text-ide-text-dim">NO</span>}</td>
            <td className="px-3 py-1 text-ide-text-dim">{col.dflt_value ?? '—'}</td>
            <td className="px-3 py-1">{col.pk ? <span className="text-ide-yellow">🔑</span> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-1 border-t border-ide-border bg-[#252526] shrink-0">
      <span className="text-[11px] text-ide-text-dim">Page {page + 1} / {total}</span>
      <button
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="p-0.5 disabled:opacity-30 text-ide-text-muted hover:text-ide-text"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        disabled={page >= total - 1}
        onClick={() => onPage(page + 1)}
        className="p-0.5 disabled:opacity-30 text-ide-text-muted hover:text-ide-text"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function QueryRunner({
  dbPath, result, error, query, onQueryChange, onRun,
}: {
  dbPath: string | null;
  result: { cols: string[]; rows: Record<string, unknown>[] } | null;
  error: string;
  query: string;
  onQueryChange: (q: string) => void;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Query editor */}
      <div className="border-b border-ide-border shrink-0 p-2">
        <div className="relative">
          <textarea
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                onRun();
              }
            }}
            placeholder="SELECT * FROM users LIMIT 100;    (Ctrl+Enter to run — read only)"
            rows={3}
            className="w-full bg-ide-bg text-ide-text text-[12px] font-mono px-3 py-2 border border-ide-border focus:border-ide-accent outline-none resize-none placeholder:text-ide-text-dim"
          />
          <button
            onClick={onRun}
            disabled={!dbPath || !query.trim()}
            className="absolute right-2 bottom-2 flex items-center gap-1 px-2 py-1 bg-ide-accent hover:bg-[#1a8ad4] disabled:opacity-40 text-white text-[12px] transition-colors"
          >
            <Play size={11} fill="white" /> Run
          </button>
        </div>
        <div className="text-[10px] text-ide-text-dim mt-1">Read-only queries only. Ctrl+Enter to execute.</div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-2 p-2 bg-[#3d1212] border border-ide-red text-ide-red text-[12px] font-mono">{error}</div>
        )}
        {result && (
          result.rows.length === 0 ? (
            <div className="p-4 text-ide-text-dim text-[13px]">Query returned no rows.</div>
          ) : (
            <DataTable columns={result.cols} rows={result.rows} />
          )
        )}
        {!error && !result && (
          <div className="p-4 text-ide-text-dim text-[13px]">Run a query to see results.</div>
        )}
      </div>
    </div>
  );
}
