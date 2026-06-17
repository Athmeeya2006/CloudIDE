import { create } from 'zustand';
import { Process } from '../types';
import { processApi } from '../api/client';

interface ProcessStore {
  processes: Process[];
  activeProcessId: string | null;
  logsMap: Record<string, string[]>;

  fetchProcesses: () => Promise<void>;
  runCommand: (command: string, cwd: string, name?: string) => Promise<Process>;
  stopProcess: (id: string) => Promise<void>;
  restartProcess: (id: string) => Promise<void>;
  removeProcess: (id: string) => Promise<void>;
  setActiveProcess: (id: string) => void;
  appendLog: (id: string, line: string) => void;
  clearLogs: (id: string) => void;
}

export const useProcessStore = create<ProcessStore>((set) => ({
  processes: [],
  activeProcessId: null,
  logsMap: {},

  fetchProcesses: async () => {
    const list = await processApi.list();
    set({ processes: list });
  },

  runCommand: async (command, cwd, name) => {
    const proc = await processApi.create(command, cwd, name);
    set(state => ({
      processes: [...state.processes.filter(p => p.id !== proc.id), proc],
      activeProcessId: proc.id,
      logsMap: { ...state.logsMap, [proc.id]: [] },
    }));
    return proc;
  },

  stopProcess: async (id) => {
    const proc = await processApi.stop(id);
    set(state => ({
      processes: state.processes.map(p => p.id === id ? proc : p),
    }));
  },

  restartProcess: async (id) => {
    const proc = await processApi.restart(id);
    set(state => ({
      processes: state.processes.map(p => p.id === id ? proc : p),
      logsMap: { ...state.logsMap, [id]: [] },
    }));
  },

  removeProcess: async (id) => {
    await processApi.remove(id);
    set(state => ({
      processes: state.processes.filter(p => p.id !== id),
      activeProcessId: state.activeProcessId === id ? null : state.activeProcessId,
    }));
  },

  setActiveProcess: (id) => set({ activeProcessId: id }),

  appendLog: (id, line) => {
    set(state => ({
      logsMap: {
        ...state.logsMap,
        [id]: [...(state.logsMap[id] || []).slice(-4000), line],
      },
    }));
  },

  clearLogs: (id) => {
    set(state => ({ logsMap: { ...state.logsMap, [id]: [] } }));
  },
}));
