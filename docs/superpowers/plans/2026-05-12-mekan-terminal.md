# Mekan Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop terminal manager with project sidebar, split-pane terminals, process monitoring, and git worktree management.

**Architecture:** Electron main process handles PTY spawning (node-pty), git operations (simple-git), and config persistence. React renderer shows split-pane terminals (xterm.js + allotment), project sidebar, git panel, and status bar. Communication via Electron IPC with typed channels.

**Tech Stack:** Electron, React, TypeScript, Vite, node-pty, xterm.js, simple-git, allotment, Zustand, Tailwind CSS, chokidar, electron-builder

---

## File Map

```
mekan-terminal/
├── package.json                          # Dependencies, scripts
├── electron-builder.yml                  # .exe packaging config
├── vite.main.config.ts                   # Vite config for main process
├── vite.renderer.config.ts               # Vite config for renderer
├── tailwind.config.js                    # Tailwind configuration
├── tsconfig.json                         # Base TS config
├── tsconfig.main.json                    # Main process TS config
├── tsconfig.renderer.json                # Renderer TS config
├── src/
│   ├── shared/
│   │   └── types.ts                      # All shared types (IPC channels, Project, Terminal, Git, Layout)
│   ├── main/
│   │   ├── index.ts                      # Electron app entry — creates window, registers all IPC handlers
│   │   ├── config-store.ts               # Reads/writes ~/.mekan/ JSON files
│   │   ├── pty-manager.ts                # Manages node-pty instances: spawn, write, resize, kill, status tracking
│   │   └── ipc/
│   │       ├── terminal.ts               # IPC handlers: pty:spawn, pty:write, pty:resize, pty:kill, pty:restart
│   │       ├── git.ts                    # IPC handlers: git:branches, git:worktrees, git:commits, git:worktree-add/remove
│   │       └── projects.ts              # IPC handlers: project:list, project:add, project:remove, project:rename, project:reorder
│   ├── renderer/
│   │   ├── index.html                    # HTML entry point
│   │   ├── main.tsx                      # React entry — renders <App />
│   │   ├── App.tsx                       # Root layout: Sidebar | TerminalGrid | GitPanel + StatusBar
│   │   ├── stores/
│   │   │   ├── projects.ts              # Zustand: project list, active project, CRUD actions
│   │   │   ├── terminals.ts             # Zustand: terminal instances per project, layout tree, spawn/kill actions
│   │   │   └── git.ts                   # Zustand: branches, worktrees, commits, refresh logic
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   │   ├── Sidebar.tsx          # Project list, add button, collapsed mode
│   │   │   │   └── ProjectItem.tsx      # Single project row: name, branch badge, terminal count, context menu
│   │   │   ├── TerminalGrid/
│   │   │   │   ├── TerminalGrid.tsx     # Recursive split-pane renderer using allotment
│   │   │   │   └── SplitNode.tsx        # Renders a single split node (leaf=terminal, branch=nested split)
│   │   │   ├── TerminalPane/
│   │   │   │   ├── TerminalPane.tsx     # xterm.js instance + header bar with status/controls
│   │   │   │   └── useTerminal.ts       # Hook: attaches xterm to DOM, connects IPC data stream, handles fit/resize
│   │   │   ├── GitPanel/
│   │   │   │   ├── GitPanel.tsx         # Collapsible right panel container
│   │   │   │   ├── BranchSection.tsx    # Current branch, dirty indicator
│   │   │   │   ├── WorktreeSection.tsx  # Worktree list with CRUD buttons, create dialog
│   │   │   │   └── CommitSection.tsx    # Recent 10 commits list
│   │   │   └── StatusBar/
│   │   │       └── StatusBar.tsx        # Bottom bar: project name, branch, terminal count, git toggle
│   │   └── styles/
│   │       └── globals.css              # Tailwind directives + xterm overrides
└── resources/
    └── icon.png                          # App icon (256x256)
```

---

### Task 1: Project Scaffolding & Electron Shell

**Files:**
- Create: `package.json`
- Create: `electron-builder.yml`
- Create: `vite.main.config.ts`
- Create: `vite.renderer.config.ts`
- Create: `tailwind.config.js`
- Create: `tsconfig.json`
- Create: `tsconfig.main.json`
- Create: `tsconfig.renderer.json`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/styles/globals.css`
- Create: `src/main/index.ts`
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: Initialize git repo**

```bash
cd C:\Projetos\mekan-terminal
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "mekan-terminal",
  "version": "0.1.0",
  "description": "Terminal manager with project sidebar, split panes, and git worktree management",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"vite build --config vite.main.config.ts --watch\" \"vite --config vite.renderer.config.ts\"",
    "dev:renderer": "vite --config vite.renderer.config.ts",
    "build:main": "vite build --config vite.main.config.ts",
    "build:renderer": "vite build --config vite.renderer.config.ts",
    "build": "npm run build:main && npm run build:renderer",
    "start": "electron dist/main/index.js",
    "package": "npm run build && electron-builder"
  },
  "dependencies": {
    "allotment": "^1.0.9",
    "chokidar": "^3.6.0",
    "node-pty": "^1.0.0",
    "simple-git": "^3.27.0",
    "xterm": "^5.5.0",
    "xterm-addon-fit": "^0.10.0",
    "xterm-addon-web-links": "^0.11.0",
    "zustand": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json (base)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create tsconfig.main.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist/main",
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 5: Create tsconfig.renderer.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist/renderer",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["node"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 6: Create vite.main.config.ts**

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/main',
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['electron', 'node-pty', 'chokidar', 'simple-git'],
    },
    minify: false,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 7: Create vite.renderer.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 8: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0e0e10',
          1: '#18181b',
          2: '#1e1e22',
          3: '#27272a',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
        },
        status: {
          running: '#22c55e',
          exited: '#ef4444',
          idle: '#71717a',
        },
      },
      fontSize: {
        xxs: '0.65rem',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 9: Create src/renderer/styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #0e0e10;
  color: #e4e4e7;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

.xterm {
  padding: 4px;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 3px;
}
```

- [ ] **Step 10: Create src/renderer/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mekan Terminal</title>
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Create src/renderer/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: Create src/renderer/App.tsx (placeholder)**

```tsx
export default function App() {
  return (
    <div className="flex h-screen w-screen bg-surface-0 text-zinc-200">
      <div className="w-60 bg-surface-1 border-r border-zinc-800 p-2">
        Sidebar
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 bg-surface-0 p-2">Terminal Grid</div>
        <div className="h-8 bg-surface-2 border-t border-zinc-800 px-3 flex items-center text-xs text-zinc-400">
          Status Bar
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 13: Create src/main/index.ts (Electron entry)**

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: 'Mekan Terminal',
    backgroundColor: '#0e0e10',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#18181b',
      symbolColor: '#e4e4e7',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 14: Create electron-builder.yml**

```yaml
appId: com.mekan.terminal
productName: Mekan Terminal
directories:
  output: release
  buildResources: resources
files:
  - dist/**/*
  - resources/**/*
win:
  target:
    - target: nsis
      arch:
        - x64
nsis:
  oneClick: true
  perMachine: false
  allowToChangeInstallationDirectory: false
```

- [ ] **Step 15: Create .gitignore**

```
node_modules/
dist/
release/
.env
*.log
```

- [ ] **Step 16: Install dependencies**

Run: `npm install`
Expected: Successful install, `node_modules` created, no errors.

- [ ] **Step 17: Verify dev startup**

Run: `npm run build:main && npm run start`
Expected: Electron window opens showing placeholder layout with "Sidebar", "Terminal Grid", "Status Bar" text.

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron + React + Vite project with placeholder layout"
```

---

### Task 2: Shared Types & IPC Preload Bridge

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/main/preload.ts`
- Modify: `vite.main.config.ts` (add preload entry)

- [ ] **Step 1: Create src/shared/types.ts**

```typescript
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
```

- [ ] **Step 2: Create src/main/preload.ts**

```typescript
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
```

- [ ] **Step 3: Add global type declaration for renderer**

Create `src/renderer/env.d.ts`:

```typescript
import type { IpcApi } from '@shared/types';

declare global {
  interface Window {
    mekan: IpcApi;
  }
}
```

- [ ] **Step 4: Add preload to vite.main.config.ts build**

Replace `vite.main.config.ts` with:

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/main',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'src/main/index.ts'),
        preload: path.resolve(__dirname, 'src/main/preload.ts'),
      },
      output: {
        format: 'cjs',
        entryFileNames: '[name].js',
      },
      external: ['electron', 'node-pty', 'chokidar', 'simple-git'],
    },
    minify: false,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 5: Build and verify no type errors**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx tsc --noEmit -p tsconfig.renderer.json`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/preload.ts src/renderer/env.d.ts vite.main.config.ts
git commit -m "feat: add shared types, IPC preload bridge, and global type declarations"
```

---

### Task 3: Config Store & Project IPC Handlers

**Files:**
- Create: `src/main/config-store.ts`
- Create: `src/main/ipc/projects.ts`
- Modify: `src/main/index.ts` (register IPC handlers)

- [ ] **Step 1: Create src/main/config-store.ts**

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';

const MEKAN_DIR = path.join(os.homedir(), '.mekan');
const PROJECTS_FILE = path.join(MEKAN_DIR, 'projects.json');
const LAYOUTS_DIR = path.join(MEKAN_DIR, 'layouts');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function init() {
  ensureDir(MEKAN_DIR);
  ensureDir(LAYOUTS_DIR);
}

export function readProjects(): unknown[] {
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
  return JSON.parse(raw);
}

export function writeProjects(projects: unknown[]) {
  ensureDir(MEKAN_DIR);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

export function readLayout(projectId: string): unknown | null {
  const file = path.join(LAYOUTS_DIR, `${projectId}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

export function writeLayout(projectId: string, layout: unknown) {
  ensureDir(LAYOUTS_DIR);
  const file = path.join(LAYOUTS_DIR, `${projectId}.json`);
  fs.writeFileSync(file, JSON.stringify(layout, null, 2), 'utf-8');
}
```

- [ ] **Step 2: Create src/main/ipc/projects.ts**

```typescript
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
```

- [ ] **Step 3: Update src/main/index.ts to register handlers**

Replace `src/main/index.ts` with:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import * as configStore from './config-store';
import * as projectsIpc from './ipc/projects';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: 'Mekan Terminal',
    backgroundColor: '#0e0e10',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#18181b',
      symbolColor: '#e4e4e7',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  configStore.init();
  projectsIpc.register();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:main`
Expected: Builds without errors, `dist/main/index.js` and `dist/main/preload.js` exist.

- [ ] **Step 5: Commit**

```bash
git add src/main/config-store.ts src/main/ipc/projects.ts src/main/index.ts
git commit -m "feat: add config store and project CRUD IPC handlers"
```

---

### Task 4: PTY Manager & Terminal IPC Handlers

**Files:**
- Create: `src/main/pty-manager.ts`
- Create: `src/main/ipc/terminal.ts`
- Modify: `src/main/index.ts` (register terminal IPC)

- [ ] **Step 1: Create src/main/pty-manager.ts**

```typescript
import os from 'os';
import type { BrowserWindow } from 'electron';
import type { TerminalStatus } from '@shared/types';

// node-pty is a native module — require at runtime to avoid bundler issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require('node-pty');

interface PtyEntry {
  id: string;
  projectId: string;
  process: ReturnType<typeof pty.spawn>;
  status: TerminalStatus;
  exitCode: number | null;
  cwd: string;
  shell: string;
}

const instances = new Map<string, PtyEntry>();
let counter = 0;

function detectShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

export function spawn(projectId: string, cwd: string, win: BrowserWindow): string {
  const id = `term-${++counter}`;
  const shell = detectShell();

  const proc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: process.env as Record<string, string>,
  });

  const entry: PtyEntry = {
    id,
    projectId,
    process: proc,
    status: 'running',
    exitCode: null,
    cwd,
    shell,
  };

  proc.onData((data: string) => {
    if (!win.isDestroyed()) {
      win.webContents.send(`pty:data:${id}`, data);
    }
  });

  proc.onExit(({ exitCode }: { exitCode: number }) => {
    entry.status = 'exited';
    entry.exitCode = exitCode;
    if (!win.isDestroyed()) {
      win.webContents.send(`pty:status:${id}`, 'exited', exitCode);
    }
  });

  instances.set(id, entry);

  if (!win.isDestroyed()) {
    win.webContents.send(`pty:status:${id}`, 'running', null);
  }

  return id;
}

export function write(id: string, data: string) {
  const entry = instances.get(id);
  if (entry && entry.status === 'running') {
    entry.process.write(data);
  }
}

export function resize(id: string, cols: number, rows: number) {
  const entry = instances.get(id);
  if (entry && entry.status === 'running') {
    entry.process.resize(cols, rows);
  }
}

export function kill(id: string) {
  const entry = instances.get(id);
  if (entry && entry.status === 'running') {
    entry.process.kill();
  }
  instances.delete(id);
}

export function restart(id: string, win: BrowserWindow): string | null {
  const entry = instances.get(id);
  if (!entry) return null;
  kill(id);
  return spawn(entry.projectId, entry.cwd, win);
}

export function killAll() {
  for (const [id] of instances) {
    kill(id);
  }
}
```

- [ ] **Step 2: Create src/main/ipc/terminal.ts**

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import * as ptyManager from '../pty-manager';

export function register() {
  ipcMain.handle('pty:spawn', (event, projectId: string, cwd: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return ptyManager.spawn(projectId, cwd, win);
  });

  ipcMain.on('pty:write', (_event, terminalId: string, data: string) => {
    ptyManager.write(terminalId, data);
  });

  ipcMain.on('pty:resize', (_event, terminalId: string, cols: number, rows: number) => {
    ptyManager.resize(terminalId, cols, rows);
  });

  ipcMain.on('pty:kill', (_event, terminalId: string) => {
    ptyManager.kill(terminalId);
  });

  ipcMain.handle('pty:restart', (event, terminalId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return ptyManager.restart(terminalId, win);
  });
}
```

- [ ] **Step 3: Register terminal IPC in src/main/index.ts**

Add import and registration. After `import * as projectsIpc from './ipc/projects';` add:

```typescript
import * as terminalIpc from './ipc/terminal';
import * as ptyManager from './pty-manager';
```

Inside `app.whenReady().then(...)`, after `projectsIpc.register();` add:

```typescript
  terminalIpc.register();
```

Before `app.on('window-all-closed', ...)` add:

```typescript
app.on('before-quit', () => {
  ptyManager.killAll();
});
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:main`
Expected: Builds without errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/pty-manager.ts src/main/ipc/terminal.ts src/main/index.ts
git commit -m "feat: add PTY manager and terminal IPC handlers"
```

---

### Task 5: Git IPC Handlers

**Files:**
- Create: `src/main/ipc/git.ts`
- Modify: `src/main/index.ts` (register git IPC)

- [ ] **Step 1: Create src/main/ipc/git.ts**

```typescript
import { ipcMain } from 'electron';
import simpleGit from 'simple-git';
import type { GitBranch, GitWorktree, GitCommit } from '@shared/types';

export function register() {
  ipcMain.handle('git:branches', async (_event, projectPath: string): Promise<GitBranch[]> => {
    const git = simpleGit(projectPath);

    try {
      await git.revparse(['--git-dir']);
    } catch {
      return [];
    }

    const summary = await git.branchLocal();
    const branches: GitBranch[] = [];

    for (const [name, info] of Object.entries(summary.branches)) {
      let aheadBehind: { ahead: number; behind: number } | null = null;
      try {
        const status = await git.status(['-b', '--porcelain=v2']);
        const branchStatus = status;
        aheadBehind = { ahead: branchStatus.ahead, behind: branchStatus.behind };
      } catch {
        aheadBehind = null;
      }

      branches.push({
        name,
        current: info.current,
        lastCommitMessage: info.label,
        aheadBehind: name === summary.current ? aheadBehind : null,
        worktreePath: null,
      });
    }

    try {
      const worktrees = await parseWorktrees(git);
      for (const wt of worktrees) {
        const branch = branches.find((b) => b.name === wt.branch);
        if (branch) branch.worktreePath = wt.path;
      }
    } catch {
      // not all repos support worktrees
    }

    return branches;
  });

  ipcMain.handle('git:worktrees', async (_event, projectPath: string): Promise<GitWorktree[]> => {
    const git = simpleGit(projectPath);
    try {
      return await parseWorktrees(git);
    } catch {
      return [];
    }
  });

  ipcMain.handle('git:commits', async (_event, projectPath: string, count: number): Promise<GitCommit[]> => {
    const git = simpleGit(projectPath);
    try {
      const log = await git.log({ maxCount: count, format: { hash: '%h', message: '%s', author: '%an', relativeDate: '%cr' } });
      return log.all.map((entry) => ({
        hash: entry.hash,
        message: entry.message,
        author: (entry as Record<string, string>).author ?? '',
        relativeDate: (entry as Record<string, string>).relativeDate ?? '',
      }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('git:is-dirty', async (_event, projectPath: string): Promise<boolean> => {
    const git = simpleGit(projectPath);
    try {
      const status = await git.status();
      return !status.isClean();
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    'git:worktree-add',
    async (_event, projectPath: string, wtPath: string, branch: string, createBranch: boolean) => {
      const git = simpleGit(projectPath);
      if (createBranch) {
        await git.raw(['worktree', 'add', '-b', branch, wtPath]);
      } else {
        await git.raw(['worktree', 'add', wtPath, branch]);
      }
    }
  );

  ipcMain.handle('git:worktree-remove', async (_event, projectPath: string, wtPath: string) => {
    const git = simpleGit(projectPath);
    await git.raw(['worktree', 'remove', wtPath]);
  });
}

async function parseWorktrees(git: ReturnType<typeof simpleGit>): Promise<GitWorktree[]> {
  const raw = await git.raw(['worktree', 'list', '--porcelain']);
  const worktrees: GitWorktree[] = [];
  let current: Partial<GitWorktree> = {};
  let isFirst = true;

  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as GitWorktree);
      }
      current = { path: line.slice(9), isMain: isFirst };
      isFirst = false;
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === '') {
      if (current.path) {
        worktrees.push(current as GitWorktree);
        current = {};
      }
    }
  }

  if (current.path) {
    worktrees.push(current as GitWorktree);
  }

  return worktrees;
}
```

- [ ] **Step 2: Register git IPC in src/main/index.ts**

Add import after other IPC imports:

```typescript
import * as gitIpc from './ipc/git';
```

Inside `app.whenReady().then(...)`, after `terminalIpc.register();` add:

```typescript
  gitIpc.register();
```

- [ ] **Step 3: Build and verify**

Run: `npm run build:main`
Expected: Builds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/git.ts src/main/index.ts
git commit -m "feat: add git IPC handlers for branches, worktrees, and commits"
```

---

### Task 6: Zustand Stores

**Files:**
- Create: `src/renderer/stores/projects.ts`
- Create: `src/renderer/stores/terminals.ts`
- Create: `src/renderer/stores/git.ts`

- [ ] **Step 1: Create src/renderer/stores/projects.ts**

```typescript
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
```

- [ ] **Step 2: Create src/renderer/stores/terminals.ts**

```typescript
import { create } from 'zustand';
import type { TerminalInstance, LayoutNode, LeafNode, SplitNode, SplitDirection } from '@shared/types';

interface TerminalsState {
  terminals: Record<string, TerminalInstance[]>;
  layouts: Record<string, LayoutNode | null>;

  spawnTerminal(projectId: string, cwd: string): Promise<string>;
  killTerminal(projectId: string, terminalId: string): void;
  restartTerminal(terminalId: string): Promise<string | null>;
  updateStatus(projectId: string, terminalId: string, status: TerminalInstance['status'], exitCode: number | null): void;
  splitPane(projectId: string, terminalId: string, direction: SplitDirection, cwd: string): Promise<void>;
  closePane(projectId: string, terminalId: string): void;
  loadLayout(projectId: string): Promise<void>;
  saveLayout(projectId: string): Promise<void>;
  getTerminalCount(projectId: string): number;
}

function countLeaves(node: LayoutNode | null): number {
  if (!node) return 0;
  if (node.type === 'leaf') return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function removeLeaf(node: LayoutNode | null, terminalId: string): LayoutNode | null {
  if (!node) return null;
  if (node.type === 'leaf') {
    return node.terminalId === terminalId ? null : node;
  }
  const children = node.children.map((child) => removeLeaf(child, terminalId)).filter(Boolean) as LayoutNode[];
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...node, children, sizes: children.map(() => 100 / children.length) };
}

function insertSplit(
  node: LayoutNode | null,
  targetId: string,
  direction: SplitDirection,
  newLeaf: LeafNode
): LayoutNode | null {
  if (!node) return newLeaf;
  if (node.type === 'leaf') {
    if (node.terminalId === targetId) {
      return { type: 'split', direction, sizes: [50, 50], children: [node, newLeaf] } as SplitNode;
    }
    return node;
  }
  return {
    ...node,
    children: node.children.map((child) => insertSplit(child, targetId, direction, newLeaf)).filter(Boolean) as LayoutNode[],
  };
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  terminals: {},
  layouts: {},

  async spawnTerminal(projectId, cwd) {
    const id = await window.mekan.terminal.spawn(projectId, cwd);
    const instance: TerminalInstance = { id, projectId, status: 'running', exitCode: null, cwd, shell: '' };
    set((s) => {
      const projectTerminals = [...(s.terminals[projectId] || []), instance];
      const currentLayout = s.layouts[projectId];
      const newLeaf: LeafNode = { type: 'leaf', terminalId: id };
      const newLayout = currentLayout ? currentLayout : newLeaf;
      return {
        terminals: { ...s.terminals, [projectId]: projectTerminals },
        layouts: { ...s.layouts, [projectId]: currentLayout ? currentLayout : newLayout },
      };
    });
    return id;
  },

  killTerminal(projectId, terminalId) {
    window.mekan.terminal.kill(terminalId);
    set((s) => ({
      terminals: {
        ...s.terminals,
        [projectId]: (s.terminals[projectId] || []).filter((t) => t.id !== terminalId),
      },
    }));
  },

  async restartTerminal(terminalId) {
    const newId = await window.mekan.terminal.restart(terminalId);
    return newId ?? null;
  },

  updateStatus(projectId, terminalId, status, exitCode) {
    set((s) => ({
      terminals: {
        ...s.terminals,
        [projectId]: (s.terminals[projectId] || []).map((t) =>
          t.id === terminalId ? { ...t, status, exitCode } : t
        ),
      },
    }));
  },

  async splitPane(projectId, terminalId, direction, cwd) {
    if (get().getTerminalCount(projectId) >= 6) return;
    const newId = await window.mekan.terminal.spawn(projectId, cwd);
    const instance: TerminalInstance = { id: newId, projectId, status: 'running', exitCode: null, cwd, shell: '' };
    const newLeaf: LeafNode = { type: 'leaf', terminalId: newId };
    set((s) => {
      const projectTerminals = [...(s.terminals[projectId] || []), instance];
      const layout = insertSplit(s.layouts[projectId], terminalId, direction, newLeaf);
      return {
        terminals: { ...s.terminals, [projectId]: projectTerminals },
        layouts: { ...s.layouts, [projectId]: layout },
      };
    });
  },

  closePane(projectId, terminalId) {
    window.mekan.terminal.kill(terminalId);
    set((s) => {
      const layout = removeLeaf(s.layouts[projectId], terminalId);
      return {
        terminals: {
          ...s.terminals,
          [projectId]: (s.terminals[projectId] || []).filter((t) => t.id !== terminalId),
        },
        layouts: { ...s.layouts, [projectId]: layout },
      };
    });
  },

  async loadLayout(projectId) {
    const layout = await window.mekan.layout.load(projectId);
    if (layout) {
      set((s) => ({ layouts: { ...s.layouts, [projectId]: layout.root } }));
    }
  },

  async saveLayout(projectId) {
    const layout = get().layouts[projectId];
    await window.mekan.layout.save({ projectId, root: layout ?? null });
  },

  getTerminalCount(projectId) {
    return countLeaves(get().layouts[projectId]);
  },
}));
```

- [ ] **Step 3: Create src/renderer/stores/git.ts**

```typescript
import { create } from 'zustand';
import type { GitBranch, GitWorktree, GitCommit } from '@shared/types';

interface GitState {
  branches: GitBranch[];
  worktrees: GitWorktree[];
  commits: GitCommit[];
  isDirty: boolean;
  loading: boolean;
  panelOpen: boolean;

  refresh(projectPath: string): Promise<void>;
  refreshBranches(projectPath: string): Promise<void>;
  refreshWorktrees(projectPath: string): Promise<void>;
  refreshCommits(projectPath: string): Promise<void>;
  addWorktree(projectPath: string, wtPath: string, branch: string, createBranch: boolean): Promise<void>;
  removeWorktree(projectPath: string, wtPath: string): Promise<void>;
  togglePanel(): void;
  setPanel(open: boolean): void;
}

export const useGitStore = create<GitState>((set, get) => ({
  branches: [],
  worktrees: [],
  commits: [],
  isDirty: false,
  loading: false,
  panelOpen: true,

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
}));
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.renderer.json`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stores/
git commit -m "feat: add Zustand stores for projects, terminals, and git"
```

---

### Task 7: Sidebar Component

**Files:**
- Create: `src/renderer/components/Sidebar/Sidebar.tsx`
- Create: `src/renderer/components/Sidebar/ProjectItem.tsx`

- [ ] **Step 1: Create src/renderer/components/Sidebar/ProjectItem.tsx**

```tsx
import { useState, useRef, useEffect } from 'react';
import type { Project } from '@shared/types';
import { useTerminalsStore } from '../../stores/terminals';

interface Props {
  project: Project;
  active: boolean;
  onClick(): void;
  onRename(name: string): void;
  onRemove(): void;
}

export default function ProjectItem({ project, active, onClick, onRename, onRemove }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const terminalCount = useTerminalsStore((s) => (s.terminals[project.id] || []).length);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const initial = project.name.charAt(0).toUpperCase();

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setShowMenu(true);
  }

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      className={`group relative flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
        active ? 'bg-surface-3 text-white' : 'text-zinc-400 hover:bg-surface-2 hover:text-zinc-200'
      }`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div className="w-7 h-7 rounded bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-surface-3 text-white text-sm px-1 py-0.5 rounded outline-none border border-accent"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div className="text-sm truncate">{project.name}</div>
        )}
        <div className="text-xxs text-zinc-500 truncate">{project.path}</div>
      </div>
      {terminalCount > 0 && (
        <span className="text-xxs text-zinc-500 flex-shrink-0">{terminalCount}</span>
      )}

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute left-full top-0 ml-1 z-50 bg-surface-2 border border-zinc-700 rounded shadow-lg py-1 min-w-[140px]"
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-surface-3"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setEditName(project.name);
              setEditing(true);
            }}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-surface-3"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              onRemove();
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create src/renderer/components/Sidebar/Sidebar.tsx**

```tsx
import { useEffect } from 'react';
import { useProjectsStore } from '../../stores/projects';
import ProjectItem from './ProjectItem';

export default function Sidebar() {
  const { projects, activeProjectId, loading, load, addProject, removeProject, renameProject, setActiveProject } =
    useProjectsStore();

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-zinc-800">
      <div className="p-3 flex items-center justify-between border-b border-zinc-800" style={{ marginTop: 36 }}>
        <span className="text-sm font-semibold text-zinc-300">Projects</span>
        <button
          onClick={addProject}
          className="w-6 h-6 flex items-center justify-center rounded bg-surface-3 text-zinc-400 hover:text-white hover:bg-accent transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && <div className="text-xs text-zinc-500 px-2 py-4">Loading...</div>}
        {!loading && projects.length === 0 && (
          <div className="text-xs text-zinc-500 px-2 py-4">No projects yet. Click + to add one.</div>
        )}
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            active={project.id === activeProjectId}
            onClick={() => setActiveProject(project.id)}
            onRename={(name) => renameProject(project.id, name)}
            onRemove={() => removeProject(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/
git commit -m "feat: add Sidebar and ProjectItem components"
```

---

### Task 8: Terminal Pane Component with xterm.js

**Files:**
- Create: `src/renderer/components/TerminalPane/useTerminal.ts`
- Create: `src/renderer/components/TerminalPane/TerminalPane.tsx`

- [ ] **Step 1: Create src/renderer/components/TerminalPane/useTerminal.ts**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface UseTerminalOptions {
  terminalId: string;
  onStatusChange?: (status: 'running' | 'exited', exitCode: number | null) => void;
}

export function useTerminal({ terminalId, onStatusChange }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const fit = useCallback(() => {
    if (fitRef.current) {
      try {
        fitRef.current.fit();
        if (termRef.current) {
          window.mekan.terminal.resize(terminalId, termRef.current.cols, termRef.current.rows);
        }
      } catch {
        // container not visible yet
      }
    }
  }, [terminalId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0e0e10',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        selectionBackground: '#6366f140',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
      },
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fitAddon;

    requestAnimationFrame(() => fitAddon.fit());

    term.onData((data) => {
      window.mekan.terminal.write(terminalId, data);
    });

    const removeDataListener = window.mekan.terminal.onData(terminalId, (data) => {
      term.write(data);
    });

    const removeStatusListener = window.mekan.terminal.onStatus(terminalId, (status, exitCode) => {
      onStatusChange?.(status, exitCode);
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          window.mekan.terminal.resize(terminalId, term.cols, term.rows);
        } catch {
          // not visible
        }
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      removeDataListener();
      removeStatusListener();
      term.dispose();
    };
  }, [terminalId, onStatusChange]);

  return { containerRef, fit };
}
```

- [ ] **Step 2: Create src/renderer/components/TerminalPane/TerminalPane.tsx**

```tsx
import { useCallback, useState } from 'react';
import { useTerminal } from './useTerminal';
import { useTerminalsStore } from '../../stores/terminals';
import type { TerminalStatus, SplitDirection } from '@shared/types';

interface Props {
  terminalId: string;
  projectId: string;
  cwd: string;
}

export default function TerminalPane({ terminalId, projectId, cwd }: Props) {
  const [status, setStatus] = useState<TerminalStatus>('running');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const { splitPane, closePane, getTerminalCount } = useTerminalsStore();

  const onStatusChange = useCallback(
    (newStatus: 'running' | 'exited', code: number | null) => {
      setStatus(newStatus);
      setExitCode(code);
      useTerminalsStore.getState().updateStatus(projectId, terminalId, newStatus, code);
    },
    [projectId, terminalId]
  );

  const { containerRef } = useTerminal({ terminalId, onStatusChange });

  const canSplit = getTerminalCount(projectId) < 6;

  function handleSplit(direction: SplitDirection) {
    splitPane(projectId, terminalId, direction, cwd);
  }

  function handleClose() {
    closePane(projectId, terminalId);
  }

  async function handleRestart() {
    const newId = await useTerminalsStore.getState().restartTerminal(terminalId);
    if (newId) {
      setStatus('running');
      setExitCode(null);
    }
  }

  const statusColor = status === 'running' ? 'bg-status-running' : status === 'exited' ? 'bg-status-exited' : 'bg-status-idle';

  return (
    <div className="flex flex-col h-full w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center h-7 px-2 bg-surface-2 border-b border-zinc-800 gap-2 flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} title={status === 'exited' ? `Exit code: ${exitCode}` : status} />
        <span className="text-xxs text-zinc-500 flex-1 truncate">{terminalId}</span>
        {hovered && (
          <div className="flex items-center gap-1">
            {status === 'exited' && (
              <button onClick={handleRestart} className="text-xxs text-zinc-500 hover:text-white px-1" title="Restart">
                ↻
              </button>
            )}
            {canSplit && (
              <>
                <button onClick={() => handleSplit('horizontal')} className="text-xxs text-zinc-500 hover:text-white px-1" title="Split horizontal">
                  ─
                </button>
                <button onClick={() => handleSplit('vertical')} className="text-xxs text-zinc-500 hover:text-white px-1" title="Split vertical">
                  │
                </button>
              </>
            )}
            <button onClick={handleClose} className="text-xxs text-zinc-500 hover:text-red-400 px-1" title="Close">
              ✕
            </button>
          </div>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TerminalPane/
git commit -m "feat: add TerminalPane component with xterm.js integration"
```

---

### Task 9: Terminal Grid with Recursive Split Panes

**Files:**
- Create: `src/renderer/components/TerminalGrid/SplitNode.tsx`
- Create: `src/renderer/components/TerminalGrid/TerminalGrid.tsx`

- [ ] **Step 1: Create src/renderer/components/TerminalGrid/SplitNode.tsx**

```tsx
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { LayoutNode } from '@shared/types';
import TerminalPane from '../TerminalPane/TerminalPane';

interface Props {
  node: LayoutNode;
  projectId: string;
  cwd: string;
}

export default function SplitNodeView({ node, projectId, cwd }: Props) {
  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} projectId={projectId} cwd={cwd} />;
  }

  return (
    <Allotment vertical={node.direction === 'horizontal'} defaultSizes={node.sizes}>
      {node.children.map((child, i) => (
        <Allotment.Pane key={child.type === 'leaf' ? child.terminalId : i} minSize={child.type === 'leaf' ? 120 : 80}>
          <SplitNodeView node={child} projectId={projectId} cwd={cwd} />
        </Allotment.Pane>
      ))}
    </Allotment>
  );
}
```

- [ ] **Step 2: Create src/renderer/components/TerminalGrid/TerminalGrid.tsx**

```tsx
import { useEffect } from 'react';
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import SplitNodeView from './SplitNode';

export default function TerminalGrid() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const layout = useTerminalsStore((s) => (activeProjectId ? s.layouts[activeProjectId] : null));
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);

  useEffect(() => {
    if (activeProjectId && activeProject && !layout) {
      spawnTerminal(activeProjectId, activeProject.path);
    }
  }, [activeProjectId, activeProject, layout, spawnTerminal]);

  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Select or add a project to get started.
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Starting terminal...
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0">
      <SplitNodeView node={layout} projectId={activeProjectId} cwd={activeProject.path} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TerminalGrid/
git commit -m "feat: add TerminalGrid with recursive split-pane layout"
```

---

### Task 10: Git Panel Component

**Files:**
- Create: `src/renderer/components/GitPanel/BranchSection.tsx`
- Create: `src/renderer/components/GitPanel/WorktreeSection.tsx`
- Create: `src/renderer/components/GitPanel/CommitSection.tsx`
- Create: `src/renderer/components/GitPanel/GitPanel.tsx`

- [ ] **Step 1: Create src/renderer/components/GitPanel/BranchSection.tsx**

```tsx
import { useGitStore } from '../../stores/git';

export default function BranchSection() {
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);
  const currentBranch = branches.find((b) => b.current);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400">Branches</span>
      </div>
      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {branches.length === 0 && <div className="text-xxs text-zinc-600 px-1">No git repository</div>}
        {branches.map((b) => (
          <div
            key={b.name}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
              b.current ? 'bg-surface-3 text-white' : 'text-zinc-400'
            }`}
          >
            <span className="truncate flex-1">{b.name}</span>
            {b.current && isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" title="Uncommitted changes" />
            )}
            {b.aheadBehind && (b.aheadBehind.ahead > 0 || b.aheadBehind.behind > 0) && (
              <span className="text-xxs text-zinc-500 flex-shrink-0">
                {b.aheadBehind.ahead > 0 && `↑${b.aheadBehind.ahead}`}
                {b.aheadBehind.behind > 0 && `↓${b.aheadBehind.behind}`}
              </span>
            )}
            {b.worktreePath && (
              <span className="text-xxs text-accent flex-shrink-0" title={b.worktreePath}>WT</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create src/renderer/components/GitPanel/WorktreeSection.tsx**

```tsx
import { useState } from 'react';
import { useGitStore } from '../../stores/git';

interface Props {
  projectPath: string;
}

export default function WorktreeSection({ projectPath }: Props) {
  const worktrees = useGitStore((s) => s.worktrees);
  const addWorktree = useGitStore((s) => s.addWorktree);
  const removeWorktree = useGitStore((s) => s.removeWorktree);
  const [showCreate, setShowCreate] = useState(false);
  const [branch, setBranch] = useState('');
  const [createNew, setCreateNew] = useState(false);

  async function handleCreate() {
    if (!branch.trim()) return;
    const wtPath = `${projectPath}/../.worktrees/${branch.trim()}`;
    await addWorktree(projectPath, wtPath, branch.trim(), createNew);
    setBranch('');
    setCreateNew(false);
    setShowCreate(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400">Worktrees</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs text-zinc-500 hover:text-white"
        >
          +
        </button>
      </div>
      {showCreate && (
        <div className="p-2 border-b border-zinc-800 space-y-2">
          <input
            className="w-full bg-surface-3 text-white text-xs px-2 py-1 rounded outline-none border border-zinc-700 focus:border-accent"
            placeholder="Branch name"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <label className="flex items-center gap-2 text-xxs text-zinc-400">
            <input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} className="rounded" />
            Create new branch
          </label>
          <button
            onClick={handleCreate}
            className="w-full bg-accent hover:bg-accent-hover text-white text-xs py-1 rounded transition-colors"
          >
            Create Worktree
          </button>
        </div>
      )}
      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {worktrees.length === 0 && <div className="text-xxs text-zinc-600 px-1">No worktrees</div>}
        {worktrees.map((wt) => (
          <div key={wt.path} className="flex items-center gap-2 px-2 py-1 rounded text-xs text-zinc-400 hover:bg-surface-2 group">
            <div className="flex-1 min-w-0">
              <div className="truncate text-zinc-300">{wt.branch || 'detached'}</div>
              <div className="truncate text-xxs text-zinc-600">{wt.path}</div>
            </div>
            {!wt.isMain && (
              <button
                onClick={() => removeWorktree(projectPath, wt.path)}
                className="text-xxs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                title="Remove worktree"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create src/renderer/components/GitPanel/CommitSection.tsx**

```tsx
import { useGitStore } from '../../stores/git';

export default function CommitSection() {
  const commits = useGitStore((s) => s.commits);

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash);
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400">Recent Commits</span>
      </div>
      <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
        {commits.length === 0 && <div className="text-xxs text-zinc-600 px-1">No commits</div>}
        {commits.map((c) => (
          <div
            key={c.hash}
            className="px-2 py-1 rounded text-xs hover:bg-surface-2 cursor-pointer"
            onClick={() => copyHash(c.hash)}
            title="Click to copy hash"
          >
            <div className="flex items-center gap-2">
              <span className="text-accent font-mono text-xxs">{c.hash}</span>
              <span className="text-xxs text-zinc-600">{c.relativeDate}</span>
            </div>
            <div className="text-zinc-400 truncate">{c.message}</div>
            <div className="text-xxs text-zinc-600">{c.author}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create src/renderer/components/GitPanel/GitPanel.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { useGitStore } from '../../stores/git';
import { useProjectsStore } from '../../stores/projects';
import BranchSection from './BranchSection';
import WorktreeSection from './WorktreeSection';
import CommitSection from './CommitSection';

export default function GitPanel() {
  const panelOpen = useGitStore((s) => s.panelOpen);
  const refresh = useGitStore((s) => s.refresh);
  const loading = useGitStore((s) => s.loading);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    refresh(activeProject.path);

    intervalRef.current = setInterval(() => {
      refresh(activeProject.path);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeProject, refresh]);

  if (!panelOpen || !activeProject) return null;

  return (
    <div className="w-[280px] bg-surface-1 border-l border-zinc-800 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800" style={{ marginTop: 36 }}>
        <span className="text-sm font-semibold text-zinc-300">Git</span>
        {loading && <span className="text-xxs text-zinc-500">refreshing...</span>}
        <button
          onClick={() => activeProject && refresh(activeProject.path)}
          className="text-xs text-zinc-500 hover:text-white"
          title="Refresh"
        >
          ↻
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <BranchSection />
        <WorktreeSection projectPath={activeProject.path} />
        <CommitSection />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/GitPanel/
git commit -m "feat: add GitPanel with branch, worktree, and commit sections"
```

---

### Task 11: Status Bar Component

**Files:**
- Create: `src/renderer/components/StatusBar/StatusBar.tsx`

- [ ] **Step 1: Create src/renderer/components/StatusBar/StatusBar.tsx**

```tsx
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import { useGitStore } from '../../stores/git';

export default function StatusBar() {
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const terminalCount = useTerminalsStore((s) =>
    activeProject ? (s.terminals[activeProject.id] || []).length : 0
  );
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);
  const togglePanel = useGitStore((s) => s.togglePanel);
  const panelOpen = useGitStore((s) => s.panelOpen);
  const currentBranch = branches.find((b) => b.current);

  return (
    <div className="h-7 bg-surface-2 border-t border-zinc-800 px-3 flex items-center gap-4 text-xxs text-zinc-500 flex-shrink-0">
      {activeProject && (
        <>
          <span className="text-zinc-400">{activeProject.name}</span>
          {currentBranch && (
            <span className="flex items-center gap-1">
              <span className="text-accent">{currentBranch.name}</span>
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
            </span>
          )}
          <span>{terminalCount}/6 terminals</span>
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={togglePanel}
        className={`px-2 py-0.5 rounded transition-colors ${
          panelOpen ? 'bg-accent/20 text-accent' : 'hover:text-white'
        }`}
      >
        Git
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/StatusBar/
git commit -m "feat: add StatusBar component"
```

---

### Task 12: Wire Up App.tsx — Full Layout

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Replace src/renderer/App.tsx with full layout**

```tsx
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import TerminalGrid from './components/TerminalGrid/TerminalGrid';
import GitPanel from './components/GitPanel/GitPanel';
import StatusBar from './components/StatusBar/StatusBar';
import { useGitStore } from './stores/git';

export default function App() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const setPanel = useGitStore((s) => s.setPanel);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      setWindowWidth(w);
      if (w < 1000) setPanel(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setPanel]);

  const collapsed = windowWidth < 800;

  return (
    <div className="flex h-screen w-screen bg-surface-0 text-zinc-200 overflow-hidden">
      <div className={collapsed ? 'w-12' : 'w-60'} style={{ flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex min-h-0">
          <TerminalGrid />
          <GitPanel />
        </div>
        <StatusBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build full app and verify**

Run: `npm run build && npm run start`
Expected: Electron window shows three-column layout — sidebar on left, terminal grid in center, git panel on right, status bar at bottom.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: wire up full App layout with all components"
```

---

### Task 13: Electron Builder & .exe Packaging

**Files:**
- Verify: `electron-builder.yml`
- Create: `resources/icon.png` (placeholder)

- [ ] **Step 1: Create a placeholder icon**

Create `resources/icon.png` — a 256x256 PNG. For now, create a simple placeholder:

Run: `npm install --save-dev electron-icon-builder`

Create a simple 256x256 solid-color PNG using a script:

```bash
node -e "
const { createCanvas } = require('canvas');
// If canvas isn't available, just create a 1x1 placeholder
const fs = require('fs');
const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('resources/icon.png', buf);
"
```

(A real icon can be added later — electron-builder will work with any valid PNG.)

- [ ] **Step 2: Test packaging**

Run: `npm run package`
Expected: Builds `.exe` installer in `release/` directory. May take a few minutes on first run to download Electron distributable.

- [ ] **Step 3: Commit**

```bash
git add resources/ electron-builder.yml
git commit -m "feat: add electron-builder config and placeholder icon for .exe packaging"
```

---

### Task 14: Post-Scaffolding Integration Test

This is a manual verification task to confirm all features work end-to-end.

- [ ] **Step 1: Start the app**

Run: `npm run build && npm run start`

- [ ] **Step 2: Verify sidebar**

- Click "+" to add a project (select any folder with a git repo)
- Verify project appears in sidebar with name and path
- Right-click project, verify context menu appears (Rename, Remove)
- Rename the project, verify name updates
- Add a second project, click between them

- [ ] **Step 3: Verify terminal grid**

- Verify a terminal spawns automatically when selecting a project
- Type commands in the terminal, verify input/output works
- Hover the terminal header, click split horizontal — verify a second pane appears
- Split again vertically — verify grid layout
- Close a pane, verify sibling expands
- Verify status dots: green while running, red after typing `exit`

- [ ] **Step 4: Verify git panel**

- With a git project selected, verify branches list shows
- Verify current branch is highlighted
- Verify dirty indicator shows if there are uncommitted changes
- Verify recent commits show with hash, message, author, time
- Click a commit hash, verify it copies to clipboard
- Verify worktrees section shows (at minimum the main worktree)
- Click "+" in worktrees, create a new worktree, verify it appears
- Remove the worktree, verify it disappears

- [ ] **Step 5: Verify responsive behavior**

- Resize window below 1000px wide — git panel should auto-hide
- Resize below 800px — sidebar should collapse
- Toggle git panel via status bar button
- Verify terminal resizes correctly when panes change size

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "chore: verify integration — all features working"
```
