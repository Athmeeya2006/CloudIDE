import { useEffect, useState } from 'react';
import { Plus, Database, FolderOpen, Trash2, LogOut, Loader2, ArrowRight } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';
import { projectApi } from '../../api/client';
import { DbEngine, Project } from '../../types';
import { getErrorMessage } from '../../utils';

const ENGINE_LABEL: Record<string, string> = {
  sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', none: 'No database',
};

const ENGINE_DOT: Record<string, string> = {
  sqlite: 'bg-emerald-400', postgres: 'bg-sky-400', mysql: 'bg-orange-400', mongodb: 'bg-green-400',
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

  const initial = (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <div className="auth-scene h-screen w-screen flex items-center justify-center text-ide-text">
      <div className="auth-grid" />

      <div className="card-rise glass-card relative z-10 w-[680px] max-w-[94vw] max-h-[86vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/5">
          <div>
            <h1 className="text-[18px] font-semibold text-white">Your projects</h1>
            <p className="text-[12px] text-ide-text-muted mt-0.5">
              Open a project to jump back in, or spin up a new one.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] text-ide-text-muted">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br from-[#0a84ff] to-[#2b6fff] text-white text-[13px] font-semibold">
                {initial}
              </span>
              <span className="hidden sm:block">{user?.email}</span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-ide-text-muted hover:text-ide-text flex items-center gap-1 text-[12px] px-2 py-1.5 rounded-lg hover:bg-white/5"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {/* Create */}
        <form onSubmit={handleCreate} className="px-7 py-5 border-b border-white/5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="New project name"
              className="auth-input flex-1 rounded-lg px-3.5 py-2.5 text-[13px] outline-none"
            />
            <select
              value={engine}
              onChange={e => setEngine(e.target.value as DbEngine | 'none')}
              className="auth-input rounded-lg px-3 py-2.5 text-[13px] outline-none cursor-pointer"
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
              className="btn-gradient text-white rounded-lg px-4 py-2.5 text-[13px] font-medium flex items-center justify-center gap-1.5"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Create
            </button>
          </div>
          <p className="text-[11.5px] text-ide-text-muted mt-2.5">
            Provisions a workspace and a {ENGINE_LABEL[engine]} database, with a runnable starter app.
          </p>
          {err && <div className="text-[12px] text-ide-red mt-2">{err}</div>}
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
          {loading && projects.length === 0 ? (
            <div className="p-10 text-center text-ide-text-muted text-[13px]">Loading projects…</div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto grid place-items-center w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-ide-text-muted mb-3">
                <FolderOpen size={20} />
              </div>
              <div className="text-[13px] text-ide-text">No projects yet</div>
              <div className="text-[12px] text-ide-text-muted mt-1">Create your first one above to get started.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {projects.map((p: Project) => (
                <div
                  key={p.id}
                  onClick={() => openProject(p)}
                  className="group flex items-center gap-3.5 px-4 py-3 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <span className="grid place-items-center w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-ide-accent shrink-0">
                    <FolderOpen size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-ide-text truncate">{p.name}</div>
                    <div className="text-[11.5px] text-ide-text-muted flex items-center gap-2.5 mt-1 flex-wrap">
                      {(p.databases ?? []).length === 0 ? (
                        <span>no database</span>
                      ) : (
                        (p.databases ?? []).map(d => (
                          <span key={d.id} className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${ENGINE_DOT[d.engine] ?? 'bg-ide-text-dim'}`} />
                            {ENGINE_LABEL[d.engine] ?? d.engine}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete project "${p.name}" and its database? This cannot be undone.`))
                        deleteProject(p.id);
                    }}
                    title="Delete project"
                    className="text-ide-text-muted hover:text-ide-red opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                  >
                    <Trash2 size={15} />
                  </button>
                  <ArrowRight size={16} className="text-ide-text-dim group-hover:text-ide-accent transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-7 py-2.5 border-t border-white/5 text-[11px] text-ide-text-dim flex items-center gap-1.5">
          <Database size={11} /> Databases are provisioned on shared servers and isolated per project.
        </div>
      </div>
    </div>
  );
}
