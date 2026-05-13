import { create } from 'zustand';
import type { Project } from '@shared/types';

interface ProjectsState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;

  load(): Promise<void>;
  addProject(): Promise<void>;
  removeProject(id: string): Promise<void>;
  renameProject(id: string, name: string): Promise<void>;
  reorderProjects(ids: string[]): Promise<void>;
  setServerCommand(id: string, command: string): Promise<void>;
  setWorktreeBase(id: string, basePath: string): Promise<void>;
  setLogo(id: string): Promise<void>;
  clearLogo(id: string): Promise<void>;
  setActiveProject(id: string): void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,

  async load() {
    set({ loading: true });
    const projects = await window.mekan.project.list();
    const sorted = projects.sort((a, b) => a.order - b.order);
    set({
      projects: sorted,
      loading: false,
      activeProjectId: get().activeProjectId ?? sorted[0]?.id ?? null,
    });
  },

  async addProject() {
    const folderPath = await window.mekan.project.selectFolder();
    if (!folderPath) return;
    const project = await window.mekan.project.add(folderPath, '');
    set((s) => ({
      projects: [...s.projects, project],
      activeProjectId: project.id,
    }));
  },

  async removeProject(id) {
    await window.mekan.project.remove(id);
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      return {
        projects,
        activeProjectId: s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId,
      };
    });
  },

  async renameProject(id, name) {
    await window.mekan.project.rename(id, name);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  },

  async reorderProjects(ids) {
    await window.mekan.project.reorder(ids);
    set((s) => ({
      projects: ids
        .map((id, i) => {
          const p = s.projects.find((proj) => proj.id === id);
          return p ? { ...p, order: i } : null;
        })
        .filter(Boolean) as Project[],
    }));
  },

  async setServerCommand(id, command) {
    await window.mekan.project.setServerCommand(id, command);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, serverCommand: command } : p)),
    }));
  },

  async setWorktreeBase(id, basePath) {
    await window.mekan.project.setWorktreeBase(id, basePath);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, worktreeBasePath: basePath || undefined } : p)),
    }));
  },

  async setLogo(id) {
    const filePath = await window.mekan.project.setLogo(id);
    if (filePath) {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, logo: filePath } : p)),
      }));
    }
  },

  async clearLogo(id) {
    await window.mekan.project.clearLogo(id);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, logo: undefined } : p)),
    }));
  },

  setActiveProject(id) {
    set({ activeProjectId: id });
  },
}));
