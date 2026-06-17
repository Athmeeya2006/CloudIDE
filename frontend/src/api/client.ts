import axios from 'axios';

function getWsBase(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:');
  }
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return '';
}

export const WS_BASE = getWsBase();
const BASE = import.meta.env.VITE_API_URL || '';

/** Absolute (or same-origin) URL that serves a workspace file verbatim — used
 *  to preview static HTML/CSS/JS straight from the workspace. */
export function rawFileUrl(path: string): string {
  const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${BASE}/api/files/raw/${encoded}`;
}

export const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Auth token ----
const TOKEN_KEY = 'cloud-ide-token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore (private mode) */ }
}

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      err.message = 'Request timed out. Is the backend running?';
    }
    // A 401 means the session is gone, so drop the token and let the app re-gate.
    if (err.response?.status === 401) {
      setToken(null);
    }
    return Promise.reject(err);
  },
);

// ---- Auth ----
export const authApi = {
  register: (email: string, password: string) =>
    api.post('/api/auth/register', { email, password }).then(r => r.data),
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/api/auth/me').then(r => r.data),
};

// ---- Projects ----
export const projectApi = {
  list: () => api.get('/api/projects/').then(r => r.data),
  create: (name: string, engine = 'sqlite') =>
    api.post('/api/projects/', { name, engine }).then(r => r.data),
  get: (id: string) => api.get(`/api/projects/${id}`).then(r => r.data),
  remove: (id: string) => api.delete(`/api/projects/${id}`).then(r => r.data),
  engines: () => api.get('/api/projects/engines').then(r => r.data),
  databases: (id: string) =>
    api.get(`/api/projects/${id}/databases`).then(r => r.data),
  addDatabase: (id: string, engine: string) =>
    api.post(`/api/projects/${id}/databases`, { engine }).then(r => r.data),
};

// ---- Provisioned (engine-aware) database viewer ----
export const engineDbApi = {
  info: (dbId: number) =>
    api.get(`/api/database/engine/${dbId}/info`).then(r => r.data),
  tables: (dbId: number) =>
    api.get(`/api/database/engine/${dbId}/tables`).then(r => r.data),
  schema: (dbId: number, table: string) =>
    api.get(`/api/database/engine/${dbId}/schema`, { params: { table } }).then(r => r.data),
  rows: (dbId: number, table: string, limit = 100, offset = 0) =>
    api.get(`/api/database/engine/${dbId}/rows`, { params: { table, limit, offset } }).then(r => r.data),
  query: (dbId: number, sql: string) =>
    api.post(`/api/database/engine/${dbId}/query`, { sql }).then(r => r.data),
};

// ---- Files ----
export const filesApi = {
  tree: (workspace = 'default') =>
    api.get('/api/files/tree', { params: { workspace } }).then(r => r.data),

  read: (path: string) =>
    api.get('/api/files/read', { params: { path } }).then(r => r.data),

  write: (path: string, content: string) =>
    api.post('/api/files/write', { path, content }).then(r => r.data),

  create: (path: string, is_dir = false) =>
    api.post('/api/files/create', { path, is_dir }).then(r => r.data),

  rename: (old_path: string, new_path: string) =>
    api.post('/api/files/rename', { old_path, new_path }).then(r => r.data),

  delete: (path: string) =>
    api.delete('/api/files/delete', { params: { path } }).then(r => r.data),

  search: (query: string, workspace = 'default') =>
    api.get('/api/files/search', { params: { query, workspace } }).then(r => r.data),

  grep: (query: string, workspace = 'default', caseSensitive = false) =>
    api.get('/api/files/grep', {
      params: { query, workspace, case_sensitive: caseSensitive },
    }).then(r => r.data),

  listWorkspaces: () =>
    api.get('/api/files/workspaces').then(r => r.data),

  createWorkspace: (name: string) =>
    api.post('/api/files/workspaces', { name }).then(r => r.data),

  // Use native fetch so the browser sets `multipart/form-data; boundary=...`
  // itself. Axios (configured with a JSON default Content-Type) would otherwise
  // drop the boundary and the backend couldn't parse the upload.
  upload: async (formData: FormData) => {
    const res = await fetch(`${BASE}/api/files/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.detail || `Upload failed (${res.status})`) as Error & {
        response?: { data: unknown; status: number };
      };
      err.response = { data, status: res.status };
      throw err;
    }
    return res.json();
  },
};

// ---- Processes ----
export const processApi = {
  list: () => api.get('/api/processes/').then(r => r.data),

  create: (command: string, cwd: string, name?: string, env?: Record<string, string>) =>
    api.post('/api/processes/', { command, cwd, name, env }).then(r => r.data),

  stop: (id: string) => api.post(`/api/processes/${id}/stop`).then(r => r.data),
  restart: (id: string) => api.post(`/api/processes/${id}/restart`).then(r => r.data),
  remove: (id: string) => api.delete(`/api/processes/${id}`).then(r => r.data),
};

// ---- Database ----
export const dbApi = {
  listDatabases: (workspace = 'default') =>
    api.get('/api/database/list', { params: { workspace } }).then(r => r.data),

  listTables: (db_path: string) =>
    api.get('/api/database/tables', { params: { db_path } }).then(r => r.data),

  schema: (db_path: string, table: string) =>
    api.get('/api/database/schema', { params: { db_path, table } }).then(r => r.data),

  rows: (db_path: string, table: string, limit = 100, offset = 0) =>
    api.get('/api/database/rows', { params: { db_path, table, limit, offset } }).then(r => r.data),

  query: (db_path: string, sql: string) =>
    api.post('/api/database/query', { db_path, sql }).then(r => r.data),
};

// ---- Git ----
export const gitApi = {
  clone: (url: string, workspace = 'default', folder?: string) =>
    api.post('/api/git/clone', { url, workspace, folder }).then(r => r.data),

  status: (workspace = 'default', folder = '') =>
    api.get('/api/git/status', { params: { workspace, folder } }).then(r => r.data),

  diff: (workspace = 'default', folder = '', file = '') =>
    api.get('/api/git/diff', { params: { workspace, folder, file } }).then(r => r.data),

  commit: (message: string, workspace = 'default', folder = '', add_all = true) =>
    api.post('/api/git/commit', { message, workspace, folder, add_all }).then(r => r.data),

  pull: (workspace = 'default', folder = '') =>
    api.post('/api/git/pull', { workspace, folder }).then(r => r.data),

  push: (workspace = 'default', folder = '') =>
    api.post('/api/git/push', { workspace, folder }).then(r => r.data),

  log: (workspace = 'default', folder = '') =>
    api.get('/api/git/log', { params: { workspace, folder } }).then(r => r.data),

  branches: (workspace = 'default', folder = '') =>
    api.get('/api/git/branches', { params: { workspace, folder } }).then(r => r.data),
};
