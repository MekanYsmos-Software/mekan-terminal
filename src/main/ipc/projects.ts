import { ipcMain, dialog, BrowserWindow } from 'electron';
import crypto from 'crypto';
import path from 'path';
import * as configStore from '../config-store';
import type { Project, ProjectLayout } from '@shared/types';

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
}
