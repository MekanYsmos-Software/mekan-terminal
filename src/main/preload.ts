import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi, TerminalStatus, ProjectTask, DirEntry } from '@shared/types';

const api: IpcApi = {
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    add: (folderPath, name) => ipcRenderer.invoke('project:add', folderPath, name),
    remove: (id) => ipcRenderer.invoke('project:remove', id),
    rename: (id, name) => ipcRenderer.invoke('project:rename', id, name),
    reorder: (ids) => ipcRenderer.invoke('project:reorder', ids),
    setServerCommand: (id, command) => ipcRenderer.invoke('project:set-server-command', id, command),
    setWorktreeBase: (id, basePath) => ipcRenderer.invoke('project:set-worktree-base', id, basePath),
    selectFolder: () => ipcRenderer.invoke('project:select-folder'),
    setLogo: (id: string) => ipcRenderer.invoke('project:set-logo', id),
    clearLogo: (id: string) => ipcRenderer.invoke('project:clear-logo', id),
  },
  terminal: {
    spawn: (projectId: string, cwd: string, shellType?: string) => ipcRenderer.invoke('pty:spawn', projectId, cwd, shellType),
    getAvailableShells: () => ipcRenderer.invoke('pty:available-shells'),
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
    pullRequests: (projectPath) => ipcRenderer.invoke('git:pull-requests', projectPath),
    worktreeAdd: (projectPath, path, branch, createBranch) =>
      ipcRenderer.invoke('git:worktree-add', projectPath, path, branch, createBranch),
    worktreeRemove: (projectPath, worktreePath) =>
      ipcRenderer.invoke('git:worktree-remove', projectPath, worktreePath),
    getUser: (projectPath) => ipcRenderer.invoke('git:get-user', projectPath),
    setUser: (projectPath, name, email) => ipcRenderer.invoke('git:set-user', projectPath, name, email),
  },
  layout: {
    load: (projectId) => ipcRenderer.invoke('layout:load', projectId),
    save: (layout) => ipcRenderer.invoke('layout:save', layout),
  },
  tasks: {
    list: (projectId: string) => ipcRenderer.invoke('tasks:list', projectId),
    save: (projectId: string, tasks: ProjectTask[]) => ipcRenderer.invoke('tasks:save', projectId, tasks),
  },
  fs: {
    readdir: (dirPath: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:readdir', dirPath),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:read-file', filePath),
    writeFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('fs:write-file', filePath, content),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    flashIfBlurred: () => ipcRenderer.send('window:flash-if-blurred'),
  },
  updater: {
    onUpdateAvailable: (callback: (version: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, version: string) => callback(version);
      ipcRenderer.on('updater:available', listener);
      return () => ipcRenderer.removeListener('updater:available', listener);
    },
    onUpdateDownloaded: (callback: (version: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, version: string) => callback(version);
      ipcRenderer.on('updater:downloaded', listener);
      return () => ipcRenderer.removeListener('updater:downloaded', listener);
    },
    install: () => ipcRenderer.send('updater:install'),
  },
};

contextBridge.exposeInMainWorld('mekan', api);
