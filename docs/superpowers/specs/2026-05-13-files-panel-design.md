# Files Panel Design

## Overview

Add a Files button (next to Tasks in the TerminalGrid header) that replaces the terminal grid with a file explorer + Monaco editor view. Users can browse project files across worktrees, open multiple files as tabs, edit them, and save with Ctrl+S. A back button returns to the terminal grid.

## Layout

```
┌──────────────────────────────────────────────────┐
│ [← Back]  ProjectName   [Terminal] [Tasks] [Files]│
├──────────────┬───────────────────────────────────┤
│ Worktree: ▼  │  file1.ts × │ file2.ts ×          │
│──────────────│───────────────────────────────────│
│ 📁 src/      │                                   │
│  📁 main/    │   Monaco Editor                   │
│  📁 renderer/│                                   │
│   📄 App.tsx │                                   │
│ 📄 package.. │                                   │
├──────────────┴───────────────────────────────────┤
│ statusbar                                         │
└──────────────────────────────────────────────────┘
```

- **Left pane**: File tree with worktree dropdown at top
- **Right pane**: Monaco editor with tabs
- Split uses Allotment (already a dependency) for resizable panes
- Back button returns to terminal grid

## New IPC Channels (Main Process)

| Channel | Args | Returns | Purpose |
|---------|------|---------|---------|
| `fs:readdir` | `(dirPath: string)` | `{ name: string, type: 'file' \| 'directory' }[]` | List directory contents (sorted: dirs first, then files, alphabetical) |
| `fs:readFile` | `(filePath: string)` | `string` | Read file as UTF-8 text |
| `fs:writeFile` | `(filePath: string, content: string)` | `void` | Write file content |

- Paths are validated to stay within the project/worktree directory (no path traversal)
- readdir is lazy — only fetched when a folder is expanded

## Zustand Store: `useFilesStore`

```ts
interface FilesState {
  view: 'terminals' | 'files';
  rootPath: string | null;        // current worktree/project path
  openTabs: FileTab[];             // ordered list of open tabs
  activeTabPath: string | null;    // which tab is focused
  expandedDirs: Set<string>;       // expanded directories in tree
  dirContents: Record<string, DirEntry[]>; // cached readdir results

  setView(view: 'terminals' | 'files'): void;
  setRootPath(path: string): void;
  openFile(filePath: string): void;
  closeTab(filePath: string): void;
  setActiveTab(filePath: string): void;
  setDirty(filePath: string, dirty: boolean): void;
  toggleDir(dirPath: string): void;
  loadDir(dirPath: string): Promise<void>;
}

interface FileTab {
  filePath: string;
  name: string;
  dirty: boolean;
}

interface DirEntry {
  name: string;
  type: 'file' | 'directory';
}
```

## Components

### FilesView
- Top-level component, rendered in TerminalGrid when `view === 'files'`
- Contains Allotment split: FileTree (left, default 250px) + editor area (right)

### FileTree
- Worktree dropdown at top (reuses `git:worktrees` IPC, changing selection updates rootPath)
- Recursive tree nodes, lazy-loaded on expand
- Click file → `openFile(path)`, click dir → `toggleDir(path)`
- Icons/indentation to show hierarchy
- Ignore `.git`, `node_modules`, `.next`, `dist`, `build` directories by default

### EditorTabs
- Horizontal tab bar above Monaco
- Each tab shows filename, dirty dot indicator, close button (×)
- Close with unsaved changes → confirm dialog
- Click tab → setActiveTab

### FileEditor
- Wraps `@monaco-editor/react`
- Language auto-detected from file extension
- Dark theme matching app palette
- Ctrl+S → `fs:writeFile` → clear dirty flag
- onChange → `setDirty(path, true)`
- Tab key inserts spaces (2-space indent)

## Integration Points

- **TerminalGrid header**: Add "Files" button next to Tasks, toggles `view` state
- **Worktree selector**: Reuses existing `git:worktrees` IPC from WorktreeSection
- **Preload**: Add `fs` namespace to `window.mekan` API
- **Types**: Add `fs` to `IpcApi` interface

## Dependencies

- `@monaco-editor/react` — React wrapper for Monaco editor (new dependency)
- `monaco-editor` — peer dependency, bundled by Vite
