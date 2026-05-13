# Files Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file browser + Monaco editor that replaces the terminal grid, allowing users to browse project/worktree files, open multiple tabs, edit, and save with Ctrl+S.

**Architecture:** New IPC handlers (`fs:readdir`, `fs:readFile`, `fs:writeFile`) in the main process serve filesystem operations. A new Zustand store (`useFilesStore`) manages view state, open tabs, and directory cache. A `FilesView` component with Allotment split pane replaces the terminal grid when active. Monaco editor handles syntax-highlighted editing.

**Tech Stack:** Electron IPC, `@monaco-editor/react`, Zustand, Allotment, Tailwind CSS

---

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/main/ipc/files.ts` | IPC handlers for fs:readdir, fs:readFile, fs:writeFile |
| Modify | `src/main/index.ts:5-7,87-91` | Import and register files IPC |
| Modify | `src/shared/types.ts:80-136` | Add `DirEntry` type and `fs` namespace to `IpcApi` |
| Modify | `src/main/preload.ts:1-83` | Add `fs` bridge methods |
| Create | `src/renderer/stores/files.ts` | Zustand store for view, tabs, tree state |
| Create | `src/renderer/components/FilesView/FilesView.tsx` | Top-level split layout (tree + editor) |
| Create | `src/renderer/components/FilesView/FileTree.tsx` | Directory tree with worktree selector |
| Create | `src/renderer/components/FilesView/EditorTabs.tsx` | Tab bar with dirty indicators |
| Create | `src/renderer/components/FilesView/FileEditor.tsx` | Monaco wrapper with Ctrl+S save |
| Modify | `src/renderer/components/TerminalGrid/TerminalGrid.tsx:1-191` | Add Files button, conditionally render FilesView |

---

### Task 1: Install Monaco dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @monaco-editor/react**

```bash
npm install @monaco-editor/react monaco-editor
```

- [ ] **Step 2: Verify installation**

```bash
npm ls @monaco-editor/react
```

Expected: `@monaco-editor/react@4.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(files): add monaco-editor dependency"
```

---

### Task 2: Add IPC types and fs namespace to shared types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add DirEntry type after ProjectTask interface (after line 78)**

Add this before the `IpcApi` interface:

```typescript
export interface DirEntry {
  name: string;
  type: 'file' | 'directory';
}
```

- [ ] **Step 2: Add fs namespace inside IpcApi**

Add this after the `tasks` block (after line 121) inside IpcApi:

```typescript
  fs: {
    readdir(dirPath: string): Promise<DirEntry[]>;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
  };
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(files): add DirEntry type and fs namespace to IpcApi"
```

---

### Task 3: Create main process IPC handlers for filesystem

**Files:**
- Create: `src/main/ipc/files.ts`

- [ ] **Step 1: Create the file with all three handlers**

```typescript
import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.cache', '__pycache__']);

export function register() {
  ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const result: { name: string; type: 'file' | 'directory' }[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      result.push({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      });
    }
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return result;
  });

  ipcMain.handle('fs:read-file', async (_event, filePath: string) => {
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:write-file', async (_event, filePath: string, content: string) => {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  });
}
```

- [ ] **Step 2: Register in main/index.ts**

Add import at the top (after line 7, the git import):

```typescript
import * as filesIpc from './ipc/files';
```

Add registration call inside `app.whenReady()` (after line 91, `gitIpc.register()`):

```typescript
  filesIpc.register();
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/files.ts src/main/index.ts
git commit -m "feat(files): add fs IPC handlers (readdir, readFile, writeFile)"
```

---

### Task 4: Add fs bridge to preload

**Files:**
- Modify: `src/main/preload.ts`

- [ ] **Step 1: Add DirEntry to the type import (line 2)**

Change:
```typescript
import type { IpcApi, TerminalStatus, ProjectTask } from '@shared/types';
```
To:
```typescript
import type { IpcApi, TerminalStatus, ProjectTask, DirEntry } from '@shared/types';
```

- [ ] **Step 2: Add fs namespace to the api object**

Add after the `tasks` block (after line 58), before `shell`:

```typescript
  fs: {
    readdir: (dirPath: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:readdir', dirPath),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:read-file', filePath),
    writeFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('fs:write-file', filePath, content),
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/main/preload.ts
git commit -m "feat(files): add fs bridge to preload"
```

---

### Task 5: Create the files Zustand store

**Files:**
- Create: `src/renderer/stores/files.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';
import type { DirEntry } from '@shared/types';

export interface FileTab {
  filePath: string;
  name: string;
  dirty: boolean;
  content: string;
}

interface FilesState {
  view: 'terminals' | 'files';
  rootPath: string | null;
  openTabs: FileTab[];
  activeTabPath: string | null;
  expandedDirs: Set<string>;
  dirContents: Record<string, DirEntry[]>;

  setView(view: 'terminals' | 'files'): void;
  setRootPath(path: string): void;
  openFile(filePath: string, fileName: string): Promise<void>;
  closeTab(filePath: string): boolean;
  setActiveTab(filePath: string): void;
  setDirty(filePath: string, dirty: boolean): void;
  updateContent(filePath: string, content: string): void;
  saveFile(filePath: string): Promise<void>;
  toggleDir(dirPath: string): Promise<void>;
  loadDir(dirPath: string): Promise<void>;
  reset(): void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  view: 'terminals',
  rootPath: null,
  openTabs: [],
  activeTabPath: null,
  expandedDirs: new Set(),
  dirContents: {},

  setView(view) {
    set({ view });
  },

  setRootPath(rootPath) {
    set({ rootPath, expandedDirs: new Set(), dirContents: {} });
    get().loadDir(rootPath);
  },

  async openFile(filePath, fileName) {
    const existing = get().openTabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabPath: filePath });
      return;
    }
    const content = await window.mekan.fs.readFile(filePath);
    set((s) => ({
      openTabs: [...s.openTabs, { filePath, name: fileName, dirty: false, content }],
      activeTabPath: filePath,
    }));
  },

  closeTab(filePath) {
    const tab = get().openTabs.find((t) => t.filePath === filePath);
    if (tab?.dirty) {
      const confirmed = window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`);
      if (!confirmed) return false;
    }
    const tabs = get().openTabs.filter((t) => t.filePath !== filePath);
    const wasActive = get().activeTabPath === filePath;
    set({
      openTabs: tabs,
      activeTabPath: wasActive ? (tabs[tabs.length - 1]?.filePath ?? null) : get().activeTabPath,
    });
    return true;
  },

  setActiveTab(filePath) {
    set({ activeTabPath: filePath });
  },

  setDirty(filePath, dirty) {
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.filePath === filePath ? { ...t, dirty } : t
      ),
    }));
  },

  updateContent(filePath, content) {
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.filePath === filePath ? { ...t, content, dirty: true } : t
      ),
    }));
  },

  async saveFile(filePath) {
    const tab = get().openTabs.find((t) => t.filePath === filePath);
    if (!tab) return;
    await window.mekan.fs.writeFile(filePath, tab.content);
    get().setDirty(filePath, false);
  },

  async toggleDir(dirPath) {
    const expanded = new Set(get().expandedDirs);
    if (expanded.has(dirPath)) {
      expanded.delete(dirPath);
      set({ expandedDirs: expanded });
    } else {
      expanded.add(dirPath);
      set({ expandedDirs: expanded });
      if (!get().dirContents[dirPath]) {
        await get().loadDir(dirPath);
      }
    }
  },

  async loadDir(dirPath) {
    const entries = await window.mekan.fs.readdir(dirPath);
    set((s) => ({
      dirContents: { ...s.dirContents, [dirPath]: entries },
    }));
  },

  reset() {
    set({
      view: 'terminals',
      rootPath: null,
      openTabs: [],
      activeTabPath: null,
      expandedDirs: new Set(),
      dirContents: {},
    });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/files.ts
git commit -m "feat(files): create files Zustand store"
```

---

### Task 6: Create FileTree component

**Files:**
- Create: `src/renderer/components/FilesView/FileTree.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { useGitStore } from '../../stores/git';
import type { DirEntry } from '@shared/types';

const SEP = navigator.platform.startsWith('Win') ? '\\' : '/';

function TreeNode({ entry, parentPath, depth }: { entry: DirEntry; parentPath: string; depth: number }) {
  const fullPath = parentPath + SEP + entry.name;
  const expanded = useFilesStore((s) => s.expandedDirs.has(fullPath));
  const children = useFilesStore((s) => s.dirContents[fullPath]);
  const toggleDir = useFilesStore((s) => s.toggleDir);
  const openFile = useFilesStore((s) => s.openFile);
  const activeTabPath = useFilesStore((s) => s.activeTabPath);
  const isActive = entry.type === 'file' && activeTabPath === fullPath;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-0.5 text-xxs hover:bg-surface-3 transition-colors rounded-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleDir(fullPath)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-500/70">
            <path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8.5 4.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="currentColor"/>
          </svg>
          <span className="truncate text-zinc-400">{entry.name}</span>
        </button>
        {expanded && children && (
          <div>
            {children.map((child) => (
              <TreeNode key={child.name} entry={child} parentPath={fullPath} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={`flex items-center gap-1 w-full text-left px-2 py-0.5 text-xxs transition-colors rounded-sm ${
        isActive ? 'bg-accent/15 text-white' : 'text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => openFile(fullPath, entry.name)}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-0">
        <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-zinc-600">
        <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

interface Props {
  projectPath: string;
}

export default function FileTree({ projectPath }: Props) {
  const rootPath = useFilesStore((s) => s.rootPath);
  const rootEntries = useFilesStore((s) => (s.rootPath ? s.dirContents[s.rootPath] : undefined));
  const setRootPath = useFilesStore((s) => s.setRootPath);
  const worktrees = useGitStore((s) => s.worktrees);

  useEffect(() => {
    if (!rootPath) {
      setRootPath(projectPath);
    }
  }, [projectPath, rootPath, setRootPath]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {worktrees.length > 1 && (
        <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
          <select
            className="w-full bg-surface-3 text-xxs text-zinc-300 rounded-md px-2 py-1 border border-border outline-none focus:border-accent transition-colors"
            value={rootPath || projectPath}
            onChange={(e) => setRootPath(e.target.value)}
          >
            {worktrees.map((wt) => (
              <option key={wt.path} value={wt.path}>
                {wt.branch || 'detached'} — {wt.isMain ? 'main' : wt.path.split(/[\\/]/).pop()}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-1">
        {rootEntries ? (
          rootEntries.map((entry) => (
            <TreeNode key={entry.name} entry={entry} parentPath={rootPath || projectPath} depth={0} />
          ))
        ) : (
          <div className="text-xxs text-zinc-600 px-3 py-4 text-center animate-pulse-subtle">Loading...</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/FilesView/FileTree.tsx
git commit -m "feat(files): create FileTree component with worktree selector"
```

---

### Task 7: Create EditorTabs component

**Files:**
- Create: `src/renderer/components/FilesView/EditorTabs.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useFilesStore } from '../../stores/files';

export default function EditorTabs() {
  const openTabs = useFilesStore((s) => s.openTabs);
  const activeTabPath = useFilesStore((s) => s.activeTabPath);
  const setActiveTab = useFilesStore((s) => s.setActiveTab);
  const closeTab = useFilesStore((s) => s.closeTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center h-8 bg-surface-1 border-b border-border overflow-x-auto flex-shrink-0">
      {openTabs.map((tab) => (
        <div
          key={tab.filePath}
          className={`group flex items-center gap-1.5 px-3 h-full text-xxs cursor-pointer border-r border-border transition-colors ${
            tab.filePath === activeTabPath
              ? 'bg-surface-0 text-white'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-2'
          }`}
          onClick={() => setActiveTab(tab.filePath)}
        >
          <span className="truncate max-w-[120px]">{tab.name}</span>
          {tab.dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          )}
          <button
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-sm text-zinc-600 hover:text-white hover:bg-surface-3 transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.filePath);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/FilesView/EditorTabs.tsx
git commit -m "feat(files): create EditorTabs component"
```

---

### Task 8: Create FileEditor component with Monaco

**Files:**
- Create: `src/renderer/components/FilesView/FileEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useCallback, useEffect } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useFilesStore } from '../../stores/files';

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html',
  yml: 'yaml', yaml: 'yaml', py: 'python', rs: 'rust', go: 'go',
  sh: 'shell', bash: 'shell', ps1: 'powershell', sql: 'sql',
  xml: 'xml', svg: 'xml', toml: 'ini', env: 'ini', gitignore: 'plaintext',
};

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_LANGUAGE[ext] || 'plaintext';
}

export default function FileEditor() {
  const activeTab = useFilesStore((s) => s.openTabs.find((t) => t.filePath === s.activeTabPath));
  const updateContent = useFilesStore((s) => s.updateContent);
  const saveFile = useFilesStore((s) => s.saveFile);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = ed;
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const path = useFilesStore.getState().activeTabPath;
      if (path) saveFile(path);
    });
  }, [saveFile]);

  const handleChange = useCallback((value: string | undefined) => {
    if (value === undefined || !activeTab) return;
    updateContent(activeTab.filePath, value);
  }, [activeTab?.filePath, updateContent]);

  useEffect(() => {
    if (editorRef.current && activeTab) {
      editorRef.current.focus();
    }
  }, [activeTab?.filePath]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-zinc-600">Select a file to edit</div>
      </div>
    );
  }

  return (
    <Editor
      key={activeTab.filePath}
      defaultValue={activeTab.content}
      language={getLanguage(activeTab.name)}
      theme="mekan-dark"
      onMount={handleMount}
      onChange={handleChange}
      beforeMount={(monaco) => {
        monaco.editor.defineTheme('mekan-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#09090b',
            'editor.foreground': '#d4d4d8',
            'editorCursor.foreground': '#6366f1',
            'editor.selectionBackground': '#6366f130',
            'editor.lineHighlightBackground': '#18181b',
            'editorLineNumber.foreground': '#3f3f46',
            'editorLineNumber.activeForeground': '#71717a',
            'editorWidget.background': '#18181b',
            'editorWidget.border': '#27272a',
            'input.background': '#18181b',
            'input.border': '#27272a',
            'scrollbar.shadow': '#00000000',
            'scrollbarSlider.background': '#27272a80',
            'scrollbarSlider.hoverBackground': '#3f3f4680',
          },
        });
      }}
      options={{
        fontSize: 14,
        fontFamily: "'Cascadia Mono', 'Cascadia Code', 'Consolas', monospace",
        lineHeight: 1.6,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        padding: { top: 8 },
        renderLineHighlight: 'gutter',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorWidth: 2,
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/FilesView/FileEditor.tsx
git commit -m "feat(files): create FileEditor component with Monaco"
```

---

### Task 9: Create FilesView top-level component

**Files:**
- Create: `src/renderer/components/FilesView/FilesView.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import FileTree from './FileTree';
import EditorTabs from './EditorTabs';
import FileEditor from './FileEditor';

interface Props {
  projectPath: string;
}

export default function FilesView({ projectPath }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <Allotment>
        <Allotment.Pane preferredSize={250} minSize={150} maxSize={450}>
          <FileTree projectPath={projectPath} />
        </Allotment.Pane>
        <Allotment.Pane>
          <div className="flex flex-col h-full min-h-0">
            <EditorTabs />
            <div className="flex-1 min-h-0">
              <FileEditor />
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/FilesView/FilesView.tsx
git commit -m "feat(files): create FilesView layout with Allotment split"
```

---

### Task 10: Integrate FilesView into TerminalGrid

**Files:**
- Modify: `src/renderer/components/TerminalGrid/TerminalGrid.tsx`

- [ ] **Step 1: Add imports**

Add at the top of the file after the existing imports:

```typescript
import { useFilesStore } from '../../stores/files';
import FilesView from '../FilesView/FilesView';
```

- [ ] **Step 2: Add store subscriptions inside the component**

Add after the `pendingCount` line (around line 47):

```typescript
  const filesView = useFilesStore((s) => s.view);
  const setFilesView = useFilesStore((s) => s.setView);
```

- [ ] **Step 3: Add Files button in the header bar**

After the Tasks `<div className="relative">` block (after the closing `</div>` around line 170), add:

```tsx
        <button
          onClick={() => setFilesView(filesView === 'files' ? 'terminals' : 'files')}
          className={`flex items-center gap-1.5 text-xxs px-2.5 py-1 rounded-md transition-all duration-200 font-medium ${
            filesView === 'files'
              ? 'bg-accent/20 text-accent'
              : 'text-zinc-500 hover:text-white bg-surface-3 hover:bg-surface-4'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Files
        </button>
```

- [ ] **Step 4: Conditionally render FilesView or terminal grid**

Replace the terminal grid section (the `<div className="flex-1 min-h-0 min-w-0 grid ...">` block and its children) with:

```tsx
      {filesView === 'files' ? (
        <FilesView projectPath={activeProjectPath!} />
      ) : (
        <div
          className="flex-1 min-h-0 min-w-0 grid gap-[1px] bg-border"
          style={getGridStyle(terminals.length)}
        >
          {terminals.map((t, i) => (
            <div key={t.id} className="bg-surface-0 min-h-0 min-w-0">
              <TerminalPane
                terminalId={t.id}
                projectId={activeProjectId}
                cwd={t.cwd}
                index={i}
                totalCount={terminals.length}
              />
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 5: Verify dev server compiles without errors**

```bash
npm run dev
```

Expected: App starts, Files button appears in header bar. Clicking it toggles between terminal grid and files view.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/TerminalGrid/TerminalGrid.tsx
git commit -m "feat(files): integrate FilesView into TerminalGrid with toggle button"
```

---

### Task 11: Manual smoke test

- [ ] **Step 1: Test file tree**

1. Click "Files" button in header
2. File tree loads with project directory
3. Click a folder — it expands showing children
4. Click a file — Monaco editor opens with file content and a tab appears

- [ ] **Step 2: Test editor tabs**

1. Open multiple files by clicking them in the tree
2. Click tabs to switch between files
3. Type in editor — dirty dot appears on tab
4. Press Ctrl+S — dirty dot disappears (file saved)
5. Close a dirty tab — confirm dialog appears

- [ ] **Step 3: Test worktree selector**

1. If project has multiple worktrees, dropdown appears at top of file tree
2. Changing worktree reloads the file tree with new root

- [ ] **Step 4: Test toggle back**

1. Click "Files" button again — returns to terminal grid
2. Terminals are still running and visible

- [ ] **Step 5: Fix any issues found, commit final state**

```bash
git add -A
git commit -m "feat(files): complete files panel implementation"
```
