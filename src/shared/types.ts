export interface ProjectGroup {
  id: string;
  name: string;
  collapsed: boolean;
  order: number;
}

export const DEFAULT_GROUP_ID = '__general__';

export interface Project {
  id: string;
  name: string;
  path: string;
  order: number;
  groupId: string;
  serverCommand?: string;
  logo?: string;
  worktreeBasePath?: string;
}

export type TerminalStatus = 'running' | 'exited';
export type ShellType = 'pwsh' | 'cmd' | 'wsl' | 'claude';

export interface TerminalInstance {
  id: string;
  projectId: string;
  status: TerminalStatus;
  exitCode: number | null;
  cwd: string;
  shell: ShellType;
  isServer: boolean;
  name: string;
  busy: boolean;
  waiting: boolean;
}

export interface TerminalConfig {
  shell: ShellType;
  cwd: string;
  name: string;
  isServer: boolean;
}

export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUse?: ToolUseEntry[];
  timestamp: string;
  partial?: boolean;
}

export interface ToolUseEntry {
  tool: string;
  summary: string;
  input: Record<string, unknown>;
  output?: string;
}

export interface ClaudeSession {
  sessionId: string;
  messages: ClaudeMessage[];
  createdAt: string;
  lastMessageAt: string;
}

export type ClaudeStreamEvent =
  | { type: 'init'; sessionId: string; tools: string[] }
  | { type: 'text'; text: string; partial: boolean }
  | { type: 'tool_use'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; output: string }
  | { type: 'done'; cost?: number; duration?: number }
  | { type: 'error'; message: string };

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

export type TaskStatus = 'todo' | 'ongoing' | 'done';

export interface ProjectTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DirEntry {
  name: string;
  type: 'file' | 'directory';
}

export type PasteResult =
  | { kind: 'text'; text: string }
  | { kind: 'image'; text: string }
  | null;

export interface IpcApi {
  project: {
    list(): Promise<Project[]>;
    add(folderPath: string, name: string): Promise<Project>;
    remove(id: string): Promise<void>;
    rename(id: string, name: string): Promise<void>;
    reorder(ids: string[]): Promise<void>;
    setServerCommand(id: string, command: string): Promise<void>;
    setWorktreeBase(id: string, basePath: string): Promise<void>;
    selectFolder(): Promise<string | null>;
    setLogo(id: string): Promise<string | null>;
    clearLogo(id: string): Promise<void>;
    moveToGroup(id: string, groupId: string): Promise<void>;
  };
  group: {
    list(): Promise<ProjectGroup[]>;
    create(name: string): Promise<ProjectGroup>;
    remove(id: string): Promise<void>;
    rename(id: string, name: string): Promise<void>;
    reorder(ids: string[]): Promise<void>;
    toggleCollapse(id: string): Promise<void>;
  };
  terminal: {
    spawn(projectId: string, cwd: string, shellType?: ShellType): Promise<string>;
    getAvailableShells(): Promise<ShellType[]>;
    write(terminalId: string, data: string): void;
    resize(terminalId: string, cols: number, rows: number): void;
    kill(terminalId: string): void;
    restart(terminalId: string): Promise<string | null>;
    pasteImage(terminalId: string): Promise<PasteResult>;
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
    worktreeRemove(projectPath: string, worktreePath: string, deleteLocal?: string, deleteRemote?: string): Promise<void>;
    getUser(projectPath: string): Promise<{ name: string; email: string }>;
    setUser(projectPath: string, name: string, email: string): Promise<void>;
  };
  layout: {
    load(projectId: string): Promise<ProjectLayout | null>;
    save(layout: ProjectLayout): Promise<void>;
  };
  tasks: {
    list(projectId: string): Promise<ProjectTask[]>;
    save(projectId: string, tasks: ProjectTask[]): Promise<void>;
  };
  fs: {
    readdir(dirPath: string): Promise<DirEntry[]>;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  claude: {
    spawn(projectId: string, cwd: string, sessionId?: string): Promise<string>;
    send(terminalId: string, message: string): void;
    abort(terminalId: string): void;
    kill(terminalId: string): void;
    onEvent(terminalId: string, callback: (event: ClaudeStreamEvent) => void): () => void;
    loadSession(projectId: string, terminalId: string): Promise<ClaudeSession | null>;
    saveSession(projectId: string, terminalId: string, session: ClaudeSession): Promise<void>;
  };
  utils: {
    getPathForFile(file: File): string;
  };
  window: {
    minimize(): void;
    maximize(): void;
    close(): void;
    flashIfBlurred(): void;
  };
  updater: {
    onUpdateAvailable(callback: (version: string) => void): () => void;
    onUpdateDownloaded(callback: (version: string) => void): () => void;
    install(): void;
  };
}
