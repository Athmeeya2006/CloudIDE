import { useEffect, useState } from 'react';
import { Plus, Database, FolderOpen, Trash2, LogOut, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';
import { projectApi } from '../../api/client';
import { DbEngine, Project } from '../../types';
import { getErrorMessage } from '../../utils';

const ENGINE_LABEL: Record<string, string> = {
  sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', none: 'No database',
};

export function ProjectPicker() {
  const { projects, loadProjects, createProject, openProject, deleteProject, loading } =
    useProjectStore();
  const { user, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [engine, setEngine] = useState<DbEngine | 'none'>('sqlite');
  const [engines, setEngines] = useState<{ id: string; available: boolean }[]>([]);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    projectApi.engines().then(d => setEngines(d.engines)).catch(() => {});
  }, [loadProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setErr(null);
    try {
      const project = await createProject(name.trim(), engine);
      setName('');
      await openProject(project);
    } catch (e) {
      setErr(getErrorMessage(e, 'Could not create project'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-ide-bg text-ide-text">
      <div className="w-[520px] max-h-[82vh] bg-ide-sidebar border border-ide-border rounded flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-ide-border">
          <span className="text-[13px] font-medium">Projects</span>
          <div className="flex items-center gap-3 text-[12px] text-ide-text-muted">
            <span>{user?.email}</span>
            <button onClick={logout} title="Sign out" className="hover:text-ide-text flex items-center gap-1">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>

        {/* Create */}
        <form onSubmit={handleCreate} className="px-4 py-3 border-b border-ide-border flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="New project name"
              className="flex-1 bg-ide-bg border border-ide-border rounded px-3 py-2 text-[13px] outline-none focus:border-ide-accent"
            />
            <select
              value={engine}
              onChange={e => setEngine(e.target.value as DbEngine | 'none')}
              className="bg-ide-bg border border-ide-border rounded px-2 py-2 text-[13px] outline-none focus:border-ide-accent"
            >
              {['sqlite', 'postgres', 'mysql', 'mongodb', 'none'].map(id => {
                const meta = engines.find(e => e.id === id);
                const disabled = id !== 'none' && id !== 'sqlite' && meta && !meta.available;
                return (
                  <option key={id} value={id} disabled={disabled}>
                    {ENGINE_LABEL[id]}{disabled ? ' (unavailable)' : ''}
                  </option>
                );
              })}
            </select>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-ide-accent hover:bg-[#1a8ad4] disabled:opacity-50 text-white rounded px-3 py-2 text-[13px] flex items-center gap-1"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
          {err && <div className="text-[12px] text-ide-red">{err}</div>}
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && projects.length === 0 ? (
            <div className="p-6 text-center text-ide-text-muted text-[13px]">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center text-ide-text-muted text-[13px]">
              No projects yet. Create one above.
            </div>
          ) : (
            projects.map((p: Project) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-ide-border/50 hover:bg-ide-hover group"
              >
                <FolderOpen size={15} className="text-ide-text-muted shrink-0" />
                <button onClick={() => openProject(p)} className="flex-1 text-left min-w-0">
                  <div className="text-[13px] text-ide-text truncate">{p.name}</div>
                  <div className="text-[11px] text-ide-text-muted flex items-center gap-2 mt-0.5">
                    {(p.databases ?? []).length === 0 ? (
                      <span>no database</span>
                    ) : (
                      (p.databases ?? []).map(d => (
                        <span key={d.id} className="flex items-center gap-1">
                          <Database size={10} /> {ENGINE_LABEL[d.engine] ?? d.engine}
                        </span>
                      ))
                    )}
                  </div>
                </button>
                <button
                  onClick={() => openProject(p)}
                  className="text-[12px] px-3 py-1 rounded border border-ide-border hover:border-ide-accent text-ide-text"
                >
                  Open
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete project "${p.name}" and its database? This cannot be undone.`))
                      deleteProject(p.id);
                  }}
                  title="Delete project"
                  className="text-ide-text-muted hover:text-ide-red opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
