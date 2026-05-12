import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi, TerminalStatus } from '@shared/types';

const api: IpcApi = {
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    add: (folderPath, name) => ipcRenderer.invoke('project:add', folderPath, name),
    remove: (id) => ipcRenderer.invoke('project:remove', id),
    rename: (id, name) => ipcRenderer.invoke('project:rename', id, name),
    reorder: (ids) => ipcRenderer.invoke('project:reorder', ids),
    selectFolder: () => ipcRenderer.invoke('project:select-folder'),
  },
  terminal: {
    spawn: (projectId, cwd) => ipcRenderer.invoke('pty:spawn', projectId, cwd),
    write: (terminalId, data) => ipcRenderer.send('pty:write', terminalId, data),
    resize: (terminalId, cols, rows) => ipcRenderer.send('pty:resize', terminalId, cols, rows),
    kill: (terminalId) => ipcRenderer.send('pty:kill', terminalId),
    restart: (terminalId) => ipcRenderer.invoke('pty:restart', terminalId),
    onData: (terminalId, callback) => {
      const channel = `pty:data:${terminalId}`;
      const listener = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    onStatus: (terminalId, callback) => {
      const channel = `pty:status:${terminalId}`;
      const listener = (_event: Electron.IpcRendererEvent, status: TerminalStatus, exitCode: number | null) =>
        callback(status, exitCode);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
  git: {
    branches: (projectPath) => ipcRenderer.invoke('git:branches', projectPath),
    worktrees: (projectPath) => ipcRenderer.invoke('git:worktrees', projectPath),
    commits: (projectPath, count) => ipcRenderer.invoke('git:commits', projectPath, count),
    isDirty: (projectPath) => ipcRenderer.invoke('git:is-dirty', projectPath),
    worktreeAdd: (projectPath, path, branch, createBranch) =>
      ipcRenderer.invoke('git:worktree-add', projectPath, path, branch, createBranch),
    worktreeRemove: (projectPath, worktreePath) =>
      ipcRenderer.invoke('git:worktree-remove', projectPath, worktreePath),
  },
  layout: {
    load: (projectId) => ipcRenderer.invoke('layout:load', projectId),
    save: (layout) => ipcRenderer.invoke('layout:save', layout),
  },
};

contextBridge.exposeInMainWorld('mekan', api);
