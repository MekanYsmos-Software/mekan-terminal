import { create } from 'zustand';
import type { ProjectTask, TaskStatus } from '@shared/types';

interface TasksState {
  tasks: Record<string, ProjectTask[]>;
  loadTasks(projectId: string): Promise<void>;
  addTask(projectId: string, title: string, dueDate: string | null): void;
  updateStatus(projectId: string, taskId: string, status: TaskStatus): void;
  updateDueDate(projectId: string, taskId: string, dueDate: string | null): void;
  deleteTask(projectId: string, taskId: string): void;
  getCounts(projectId: string): { todo: number; ongoing: number; done: number };
}

function persist(projectId: string, tasks: ProjectTask[]) {
  window.mekan.tasks.save(projectId, tasks);
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: {},

  async loadTasks(projectId) {
    if (get().tasks[projectId]) return;
    const tasks = await window.mekan.tasks.list(projectId);
    set((s) => ({ tasks: { ...s.tasks, [projectId]: tasks } }));
  },

  addTask(projectId, title, dueDate) {
    const task: ProjectTask = {
      id: crypto.randomUUID(),
      title,
      status: 'todo',
      dueDate,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    const updated = [...(get().tasks[projectId] || []), task];
    set((s) => ({ tasks: { ...s.tasks, [projectId]: updated } }));
    persist(projectId, updated);
  },

  updateStatus(projectId, taskId, status) {
    const updated = (get().tasks[projectId] || []).map((t) =>
      t.id === taskId
        ? { ...t, status, completedAt: status === 'done' ? new Date().toISOString() : null }
        : t
    );
    set((s) => ({ tasks: { ...s.tasks, [projectId]: updated } }));
    persist(projectId, updated);
  },

  updateDueDate(projectId, taskId, dueDate) {
    const updated = (get().tasks[projectId] || []).map((t) =>
      t.id === taskId ? { ...t, dueDate } : t
    );
    set((s) => ({ tasks: { ...s.tasks, [projectId]: updated } }));
    persist(projectId, updated);
  },

  deleteTask(projectId, taskId) {
    const updated = (get().tasks[projectId] || []).filter((t) => t.id !== taskId);
    set((s) => ({ tasks: { ...s.tasks, [projectId]: updated } }));
    persist(projectId, updated);
  },

  getCounts(projectId) {
    const tasks = get().tasks[projectId] || [];
    return {
      todo: tasks.filter((t) => t.status === 'todo').length,
      ongoing: tasks.filter((t) => t.status === 'ongoing').length,
      done: tasks.filter((t) => t.status === 'done').length,
    };
  },
}));
