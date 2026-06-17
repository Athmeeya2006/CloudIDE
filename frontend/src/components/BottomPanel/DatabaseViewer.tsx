import { useState, useEffect, useMemo } from 'react';
import { Table, RefreshCw, Play, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { dbApi, engineDbApi } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useProjectStore } from '../../stores/projectStore';
import { cn, getErrorMessage } from '../../utils';

/** Column shape unified across engines. */
interface Col { name: string; type: string; pk?: boolean; notnull?: boolean }

/**
 * A "source" is one browsable database, regardless of engine. Provisioned
 * project databases (any engine) are addressed by their numeric id; loose
 * `.sqlite` files discovered in the workspace are addressed by path.
 */
interface DbSource {
  key: string;
  label: string;
  engine: string;
  tables: () => Promise<string[]>;
  schema: (t: string) => Promise<{ columns: Col[]; row_count: number }>;
  rows: (t: string, limit: number, offset: number) => Promise<{ rows: Record<string, unknown>[]; total: number }>;
  query: (sql: string) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>;
}

const ENGINE_LABEL: Record<string, string> = {
  sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB',
};

function provisionedSource(dbId: number, engine: string, name: string): DbSource {
  return {
    key: `pdb:${dbId}`,
    label: `${name} · ${ENGINE_LABEL[engine] ?? engine}`,
    engine,
    tables: () => engineDbApi.tables(dbId).then(d => d.tables),
    schema: (t) => engineDbApi.schema(dbId, t),
    rows: (t, limit, offset) => engineDbApi.rows(dbId, t, limit, offset),
    query: (sql) => engineDbApi.query(dbId, sql),
  };
}

function sqliteFileSource(path: string, name: string): DbSource {
  return {
    key: `file:${path}`,
    label: `${name} · file`,
    engine: 'sqlite',
    tables: () => dbApi.listTables(path).then(d => d.tables),
    schema: (t) => dbApi.schema(path, t).then(d => ({
      columns: d.columns.map((c: { name: string; type: string; pk: number; notnull: number }) =>
        ({ name: c.name, type: c.type, pk: !!c.pk, notnull: !!c.notnull })),
      row_count: d.row_count,
    })),
    rows: (t, limit, offset) => dbApi.rows(path, t, limit, offset),
    query: (sql) => dbApi.query(path, sql),
  };
}

export function DatabaseViewer() {
  const { workspace } = useFileStore();
  const projectDbs = useProjectStore(s => s.current?.databases ?? []);

  const [fileDbs, setFileDbs] = useState<{ path: string; name: string }[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [schema, setSchema] = useState<Col[]>([]);
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

  // Build the unified source list: provisioned project databases first, then
  // any loose .sqlite files found in the workspace.
  const sources = useMemo<DbSource[]>(() => {
    const provisioned = projectDbs.map(d =>
      provisionedSource(d.id, d.engine, d.db_name.split('/').pop() || d.engine));
    const files = fileDbs
      // Skip the provisioned sqlite file so it isn't listed twice.
      .filter(f => !projectDbs.some(d => d.engine === 'sqlite' && d.db_name.endsWith(f.name)))
      .map(f => sqliteFileSource(f.path, f.name));
    return [...provisioned, ...files];
  }, [projectDbs, fileDbs]);

  const source = sources.find(s => s.key === selectedKey) ?? null;

  // Discover loose sqlite files for the active workspace.
  useEffect(() => {
    dbApi.listDatabases(workspace)
      .then(d => setFileDbs(d.databases.map((x: { path: string; name: string }) => ({ path: x.path, name: x.name }))))
      .catch(() => setFileDbs([]));
  }, [workspace]);

  // Keep a valid selection as sources change.
  useEffect(() => {
    if (sources.length === 0) { setSelectedKey(null); return; }
    if (!selectedKey || !sources.some(s => s.key === selectedKey)) {
      setSelectedKey(sources[0].key);
    }
  }, [sources, selectedKey]);

  // Load tables when source changes.
  useEffect(() => {
    if (!source) { setTables([]); setSelectedTable(null); return; }
    setLoading(true);
    source.tables()
      .then(t => { setTables(t); setSelectedTable(t[0] ?? null); })
      .catch(() => { setTables([]); setSelectedTable(null); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Load schema + first page when table changes.
  useEffect(() => {
    if (!source || !selectedTable) return;
    setPage(0);
    setLoading(true);
    Promise.all([source.schema(selectedTable), source.rows(selectedTable, PAGE_SIZE, 0)])
      .then(([sch, r]) => {
        setSchema(sch.columns);
        setRows(r.rows);
        setColumns(r.rows.length > 0 ? Object.keys(r.rows[0]) : sch.columns.map(c => c.name));
        setTotal(r.total);
      })
      .catch(() => { setSchema([]); setRows([]); setColumns([]); setTotal(0); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, selectedTable]);

  const loadPage = async (p: number) => {
    if (!source || !selectedTable) return;
    const r = await source.rows(selectedTable, PAGE_SIZE, p * PAGE_SIZE);
    setRows(r.rows);
    setColumns(r.rows.length > 0 ? Object.keys(r.rows[0]) : columns);
    setPage(p);
  };

  const runQuery = async () => {
    if (!source || !query.trim()) return;
    setQueryError('');
    setQueryResult(null);
    try {
      const r = await source.query(query);
      setQueryResult({ cols: r.columns, rows: r.rows });
    } catch (e: unknown) {
      setQueryError(getErrorMessage(e, 'Query failed'));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const queryPlaceholder = source?.engine === 'mongodb'
    ? '{"collection":"users","filter":{}}   (Ctrl+Enter, read only)'
    : 'SELECT * FROM users LIMIT 100;    (Ctrl+Enter to run, read only)';

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: DB + Table list */}
      <div className="w-56 border-r border-ide-border flex flex-col bg-[#252526] shrink-0">
        <div className="px-2 py-1.5 border-b border-ide-border">
          <select
            value={selectedKey || ''}
            onChange={e => { setSelectedKey(e.target.value); setSelectedTable(null); }}
            className="w-full bg-ide-bg text-ide-text text-[12px] px-1.5 py-1 border border-ide-border focus:border-ide-accent outline-none"
          >
            {sources.length === 0 && <option value="">No databases</option>}
            {sources.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <div className="px-2 py-1 text-[10px] text-ide-text-dim uppercase tracking-wider flex items-center gap-1">
            <Database size={10} /> {source?.engine === 'mongodb' ? 'Collections' : 'Tables'}
          </div>
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

      {/* Right */}
      <div className="flex-1 flex flex-col overflow-hidden">
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

        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'data' && (
            <>
              <div className="flex-1 overflow-auto">
                {rows.length === 0 ? (
                  <div className="p-4 text-ide-text-dim text-[13px]">
                    {selectedTable ? 'No rows yet. Use your app or the live preview to add some.' : 'Select a table.'}
                  </div>
                ) : (
                  <DataTable columns={columns} rows={rows} />
                )}
              </div>
              {total > PAGE_SIZE && <Pagination page={page} total={totalPages} onPage={loadPage} />}
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
              enabled={!!source}
              result={queryResult}
              error={queryError}
              query={query}
              placeholder={queryPlaceholder}
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

function SchemaTable({ schema }: { schema: Col[] }) {
  return (
    <table className="w-full text-[12px] font-mono">
      <thead className="sticky top-0 bg-[#252526]">
        <tr>
          {['Name', 'Type', 'Not Null', 'PK'].map(h => (
            <th key={h} className="text-left px-3 py-1.5 text-ide-text-muted border-b border-r border-ide-border font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {schema.map(col => (
          <tr key={col.name} className="hover:bg-ide-hover border-b border-[#2d2d2d]">
            <td className="px-3 py-1 text-[#9cdcfe] font-medium">{col.name}</td>
            <td className="px-3 py-1 text-[#4ec9b0]">{col.type}</td>
            <td className="px-3 py-1">{col.notnull ? <span className="text-ide-red">YES</span> : <span className="text-ide-text-dim">NO</span>}</td>
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
      <button disabled={page === 0} onClick={() => onPage(page - 1)} className="p-0.5 disabled:opacity-30 text-ide-text-muted hover:text-ide-text">
        <ChevronLeft size={14} />
      </button>
      <button disabled={page >= total - 1} onClick={() => onPage(page + 1)} className="p-0.5 disabled:opacity-30 text-ide-text-muted hover:text-ide-text">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function QueryRunner({
  enabled, result, error, query, placeholder, onQueryChange, onRun,
}: {
  enabled: boolean;
  result: { cols: string[]; rows: Record<string, unknown>[] } | null;
  error: string;
  query: string;
  placeholder: string;
  onQueryChange: (q: string) => void;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-ide-border shrink-0 p-2">
        <div className="relative">
          <textarea
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); }
            }}
            placeholder={placeholder}
            rows={3}
            className="w-full bg-ide-bg text-ide-text text-[12px] font-mono px-3 py-2 border border-ide-border focus:border-ide-accent outline-none resize-none placeholder:text-ide-text-dim"
          />
          <button
            onClick={onRun}
            disabled={!enabled || !query.trim()}
            className="absolute right-2 bottom-2 flex items-center gap-1 px-2 py-1 bg-ide-accent hover:bg-[#1a8ad4] disabled:opacity-40 text-white text-[12px] transition-colors"
          >
            <Play size={11} fill="white" /> Run
          </button>
        </div>
        <div className="text-[10px] text-ide-text-dim mt-1">Read-only queries only. Ctrl+Enter to execute.</div>
      </div>

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
