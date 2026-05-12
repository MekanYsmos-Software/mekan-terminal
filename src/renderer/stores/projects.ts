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

  setActiveProject(id) {
    set({ activeProjectId: id });
  },
}));
