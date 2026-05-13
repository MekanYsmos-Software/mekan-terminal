import { create } from 'zustand';
import type { GitBranch, GitWorktree, GitCommit, GitPullRequest } from '@shared/types';

const COLLAPSE_KEY = 'mekan:git-collapsed';

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCollapsed(collapsed: Record<string, boolean>) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
}

interface GitState {
  branches: GitBranch[];
  worktrees: GitWorktree[];
  commits: GitCommit[];
  pullRequests: GitPullRequest[];
  isDirty: boolean;
  loading: boolean;
  panelOpen: boolean;
  collapsed: Record<string, boolean>;

  refresh(projectPath: string): Promise<void>;
  refreshBranches(projectPath: string): Promise<void>;
  refreshWorktrees(projectPath: string): Promise<void>;
  refreshCommits(projectPath: string): Promise<void>;
  refreshPRs(projectPath: string): Promise<void>;
  addWorktree(projectPath: string, wtPath: string, branch: string, createBranch: boolean): Promise<void>;
  removeWorktree(projectPath: string, wtPath: string): Promise<void>;
  togglePanel(): void;
  setPanel(open: boolean): void;
  toggleSection(section: string): void;
  isSectionCollapsed(section: string): boolean;
}

export const useGitStore = create<GitState>((set, get) => ({
  branches: [],
  worktrees: [],
  commits: [],
  pullRequests: [],
  isDirty: false,
  loading: false,
  panelOpen: true,
  collapsed: loadCollapsed(),

  async refresh(projectPath) {
    set({ loading: true });
    await Promise.all([
      get().refreshBranches(projectPath),
      get().refreshWorktrees(projectPath),
      get().refreshCommits(projectPath),
    ]);
    const dirty = await window.mekan.git.isDirty(projectPath);
    set({ isDirty: dirty, loading: false });
  },

  async refreshBranches(projectPath) {
    const branches = await window.mekan.git.branches(projectPath);
    set({ branches });
  },

  async refreshWorktrees(projectPath) {
    const worktrees = await window.mekan.git.worktrees(projectPath);
    set({ worktrees });
  },

  async refreshCommits(projectPath) {
    const commits = await window.mekan.git.commits(projectPath, 10);
    set({ commits });
  },

  async refreshPRs(projectPath) {
    const pullRequests = await window.mekan.git.pullRequests(projectPath);
    set({ pullRequests });
  },

  async addWorktree(projectPath, wtPath, branch, createBranch) {
    await window.mekan.git.worktreeAdd(projectPath, wtPath, branch, createBranch);
    await get().refresh(projectPath);
  },

  async removeWorktree(projectPath, wtPath) {
    await window.mekan.git.worktreeRemove(projectPath, wtPath);
    await get().refresh(projectPath);
  },

  togglePanel() {
    set((s) => ({ panelOpen: !s.panelOpen }));
  },

  setPanel(open) {
    set({ panelOpen: open });
  },

  toggleSection(section) {
    set((s) => {
      const collapsed = { ...s.collapsed, [section]: !s.collapsed[section] };
      saveCollapsed(collapsed);
      return { collapsed };
    });
  },

  isSectionCollapsed(section) {
    return !!get().collapsed[section];
  },
}));
