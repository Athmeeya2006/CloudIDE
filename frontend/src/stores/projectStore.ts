import { create } from 'zustand';
import { Project, DbEngine } from '../types';
import { projectApi } from '../api/client';
import { getErrorMessage } from '../utils';
import { useFileStore } from './fileStore';

const LAST_PROJECT_KEY = 'cloud-ide-last-project';

interface ProjectStore {
  projects: Project[];
  current: Project | null;
  loading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  createProject: (name: string, engine: DbEngine | 'none') => Promise<Project>;
  openProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  closeProject: () => void;
  refreshCurrent: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  current: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const data = await projectApi.list();
      set({ projects: data.projects ?? [], loading: false });
      // Re-open the last project automatically for a smoother return.
      const lastId = localStorage.getItem(LAST_PROJECT_KEY);
      if (lastId && !get().current) {
        const match = (data.projects ?? []).find((p: Project) => p.id === lastId);
        if (match) await get().openProject(match);
      }
    } catch (e) {
      set({ error: getErrorMessage(e, 'Failed to load projects'), loading: false });
    }
  },

  createProject: async (name, engine) => {
    const data = await projectApi.create(name, engine);
    const project: Project = data.project;
    set(state => ({ projects: [project, ...state.projects] }));
    return project;
  },

  openProject: async (project) => {
    set({ current: project });
    try { localStorage.setItem(LAST_PROJECT_KEY, project.id); } catch { /* ignore */ }
    // Point every existing file/terminal/git/db view at this project's workspace.
    await useFileStore.getState().setWorkspace(project.workspace);
  },

  deleteProject: async (id) => {
    await projectApi.remove(id);
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      current: state.current?.id === id ? null : state.current,
    }));
  },

  closeProject: () => {
    try { localStorage.removeItem(LAST_PROJECT_KEY); } catch { /* ignore */ }
    set({ current: null });
  },

  refreshCurrent: async () => {
    const cur = get().current;
    if (!cur) return;
    try {
      const data = await projectApi.get(cur.id);
      set({ current: data.project });
    } catch { /* ignore */ }
  },
}));
