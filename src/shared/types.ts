export interface Project {
  id: string;
  name: string;
  path: string;
  order: number;
  serverCommand?: string;
  logo?: string;
}

export type TerminalStatus = 'idle' | 'running' | 'exited';
export type ShellType = 'pwsh' | 'cmd' | 'wsl';

export interface TerminalInstance {
  id: string;
  projectId: string;
  status: TerminalStatus;
  exitCode: number | null;
  cwd: string;
  shell: ShellType;
  isServer: boolean;
  name: string;
}

export interface TerminalConfig {
  shell: ShellType;
  cwd: string;
  name: string;
  isServer: boolean;
}

export interface ProjectLayout {
  projectId: string;
  terminals: TerminalConfig[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  lastCommitMessage: string;
  aheadBehind: { ahead: number; behind: number } | null;
  worktreePath: string | null;
}

export interface GitWorktree {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  relativeDate: string;
}

export interface GitPullRequest {
  number: number;
  title: string;
  author: string;
  url: string;
  state: string;
  draft: boolean;
}

export interface IpcApi {
  project: {
    list(): Promise<Project[]>;
    add(folderPath: string, name: string): Promise<Project>;
    remove(id: string): Promise<void>;
    rename(id: string, name: string): Promise<void>;
    reorder(ids: string[]): Promise<void>;
    setServerCommand(id: string, command: string): Promise<void>;
    selectFolder(): Promise<string | null>;
    setLogo(id: string): Promise<string | null>;
    clearLogo(id: string): Promise<void>;
  };
  terminal: {
    spawn(projectId: string, cwd: string, shellType?: ShellType): Promise<string>;
    getAvailableShells(): Promise<ShellType[]>;
    write(terminalId: string, data: string): void;
    resize(terminalId: string, cols: number, rows: number): void;
    kill(terminalId: string): void;
    restart(terminalId: string): Promise<string | null>;
    onData(terminalId: string, callback: (data: string) => void): () => void;
    onStatus(terminalId: string, callback: (status: TerminalStatus, exitCode: number | null) => void): () => void;
  };
  git: {
    branches(projectPath: string): Promise<GitBranch[]>;
    worktrees(projectPath: string): Promise<GitWorktree[]>;
    commits(projectPath: string, count: number): Promise<GitCommit[]>;
    isDirty(projectPath: string): Promise<boolean>;
    pullRequests(projectPath: string): Promise<GitPullRequest[]>;
    worktreeAdd(projectPath: string, path: string, branch: string, createBranch: boolean): Promise<void>;
    worktreeRemove(projectPath: string, worktreePath: string): Promise<void>;
  };
  layout: {
    load(projectId: string): Promise<ProjectLayout | null>;
    save(layout: ProjectLayout): Promise<void>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
}
