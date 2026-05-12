export interface Project {
  id: string;
  name: string;
  path: string;
  order: number;
}

export type TerminalStatus = 'idle' | 'running' | 'exited';

export interface TerminalInstance {
  id: string;
  projectId: string;
  status: TerminalStatus;
  exitCode: number | null;
  cwd: string;
  shell: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  sizes: number[];
  children: LayoutNode[];
}

export interface LeafNode {
  type: 'leaf';
  terminalId: string;
}

export type LayoutNode = SplitNode | LeafNode;

export interface ProjectLayout {
  projectId: string;
  root: LayoutNode | null;
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

export interface IpcApi {
  project: {
    list(): Promise<Project[]>;
    add(folderPath: string, name: string): Promise<Project>;
    remove(id: string): Promise<void>;
    rename(id: string, name: string): Promise<void>;
    reorder(ids: string[]): Promise<void>;
    selectFolder(): Promise<string | null>;
  };
  terminal: {
    spawn(projectId: string, cwd: string): Promise<string>;
    write(terminalId: string, data: string): void;
    resize(terminalId: string, cols: number, rows: number): void;
    kill(terminalId: string): void;
    restart(terminalId: string): Promise<void>;
    onData(terminalId: string, callback: (data: string) => void): () => void;
    onStatus(terminalId: string, callback: (status: TerminalStatus, exitCode: number | null) => void): () => void;
  };
  git: {
    branches(projectPath: string): Promise<GitBranch[]>;
    worktrees(projectPath: string): Promise<GitWorktree[]>;
    commits(projectPath: string, count: number): Promise<GitCommit[]>;
    isDirty(projectPath: string): Promise<boolean>;
    worktreeAdd(projectPath: string, path: string, branch: string, createBranch: boolean): Promise<void>;
    worktreeRemove(projectPath: string, worktreePath: string): Promise<void>;
  };
  layout: {
    load(projectId: string): Promise<ProjectLayout | null>;
    save(layout: ProjectLayout): Promise<void>;
  };
}
