import { ipcMain, dialog, BrowserWindow } from 'electron';
import crypto from 'crypto';
import path from 'path';
import * as configStore from '../config-store';
import type { Project, ProjectLayout, ProjectTask } from '@shared/types';

export function register() {
  ipcMain.handle('project:list', (): Project[] => {
    return configStore.readProjects() as Project[];
  });

  ipcMain.handle('project:add', (_event, folderPath: string, name: string): Project => {
    const projects = configStore.readProjects() as Project[];
    const project: Project = {
      id: crypto.randomUUID(),
      name: name || path.basename(folderPath),
      path: folderPath,
      order: projects.length,
    };
    projects.push(project);
    configStore.writeProjects(projects);
    return project;
  });

  ipcMain.handle('project:remove', (_event, id: string) => {
    let projects = configStore.readProjects() as Project[];
    projects = projects.filter((p) => p.id !== id);
    projects.forEach((p, i) => (p.order = i));
    configStore.writeProjects(projects);
  });

  ipcMain.handle('project:rename', (_event, id: string, name: string) => {
    const projects = configStore.readProjects() as Project[];
    const project = projects.find((p) => p.id === id);
    if (project) {
      project.name = name;
      configStore.writeProjects(projects);
    }
  });

  ipcMain.handle('project:reorder', (_event, ids: string[]) => {
    const projects = configStore.readProjects() as Project[];
    const ordered = ids
      .map((id, index) => {
        const p = projects.find((proj) => proj.id === id);
        if (p) p.order = index;
        return p;
      })
      .filter(Boolean) as Project[];
    configStore.writeProjects(ordered);
  });

  ipcMain.handle('project:set-server-command', (_event, id: string, command: string) => {
    const projects = configStore.readProjects() as Project[];
    const project = projects.find((p) => p.id === id);
    if (project) {
      (project as any).serverCommand = command;
      configStore.writeProjects(projects);
    }
  });

  ipcMain.handle('project:set-worktree-base', (_event, id: string, basePath: string) => {
    const projects = configStore.readProjects() as Project[];
    const project = projects.find((p) => p.id === id);
    if (project) {
      (project as any).worktreeBasePath = basePath || undefined;
      configStore.writeProjects(projects);
    }
  });

  ipcMain.handle('project:select-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('layout:load', (_event, projectId: string): ProjectLayout | null => {
    return configStore.readLayout(projectId) as ProjectLayout | null;
  });

  ipcMain.handle('layout:save', (_event, layout: ProjectLayout) => {
    configStore.writeLayout(layout.projectId, layout);
  });

  ipcMain.handle('project:set-logo', async (event, id: string): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select Project Logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'ico', 'webp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const projects = configStore.readProjects() as Project[];
    const project = projects.find((p) => p.id === id);
    if (project) {
      (project as any).logo = filePath;
      configStore.writeProjects(projects);
    }
    return filePath;
  });

  ipcMain.handle('project:clear-logo', (_event, id: string) => {
    const projects = configStore.readProjects() as Project[];
    const project = projects.find((p) => p.id === id);
    if (project) {
      delete (project as any).logo;
      configStore.writeProjects(projects);
    }
  });

  ipcMain.handle('tasks:list', (_event, projectId: string): ProjectTask[] => {
    return configStore.readTasks(projectId) as ProjectTask[];
  });

  ipcMain.handle('tasks:save', (_event, projectId: string, tasks: ProjectTask[]) => {
    configStore.writeTasks(projectId, tasks);
  });
}
