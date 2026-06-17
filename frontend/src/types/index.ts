export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: number;
}

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  modified: boolean;
  language?: string;
}

export interface Process {
  id: string;
  name: string;
  command: string;
  status: 'running' | 'stopped' | 'error';
  os_pid?: number;
  log_count?: number;
}

export interface DbTable {
  name: string;
  row_count?: number;
}

export interface DbColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface GitFile {
  status: string;
  path: string;
}

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface GitStatus {
  files: GitFile[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface GrepResult {
  path: string;
  name: string;
  line: number;
  content: string;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  formatOnSave: boolean;
}

export type DbEngine = 'sqlite' | 'postgres' | 'mysql' | 'mongodb';

export interface ProjectDatabase {
  id: number;
  project_id: string;
  engine: DbEngine;
  db_name: string;
  status: string;
}

export interface Project {
  id: string;
  user_id: number;
  name: string;
  slug: string;
  workspace: string;
  created_at: number;
  databases?: ProjectDatabase[];
}

export interface AuthUser {
  id: number;
  email: string;
}

export interface RunService {
  name: string;
  command: string;
  cwd: string;
  run_cwd: string;
  port?: number | null;
}

export type SidebarView = 'explorer' | 'search' | 'git' | 'database';
export type BottomView = 'terminal' | 'logs' | 'db-viewer' | 'problems';
