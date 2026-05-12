# Mekan Terminal — Design Spec

## Overview

Mekan Terminal is a Windows desktop application (.exe) for managing multiple development projects, each with up to 6 flexible terminal panes, process status monitoring, and full git worktree management. Inspired by [muxy](https://github.com/muxy-app/muxy).

## Tech Stack

- **Electron** — desktop shell, main process for PTY and git operations
- **React + TypeScript** — renderer UI
- **Vite** — bundler with HMR
- **electron-builder** — .exe packaging (NSIS installer)
- **node-pty** — pseudoterminal spawning
- **xterm.js** — terminal rendering (with fit and web-links addons)
- **simple-git** — git CLI wrapper
- **allotment** — split pane layout
- **Zustand** — state management
- **Tailwind CSS** — styling
- **chokidar** — file system watcher for git auto-refresh

## Architecture

### Processes

**Main process** (Electron/Node):
- Window management (single BrowserWindow)
- PTY lifecycle via `node-pty` (spawn, write, resize, kill)
- Git operations via `simple-git`
- Project config persistence to `~/.mekan/` (JSON files)

**Renderer process** (React):
- All UI rendering: sidebar, terminal grid, git panel, status bar
- Terminal display via `xterm.js`
- State management via Zustand stores
- Communicates with main process exclusively via Electron IPC

### Data Flow

```
React UI  ──IPC──>  Main Process  ──node-pty──>  Shell (cmd/ps/bash)
                                  ──simple-git──> Git CLI
   <──IPC──  (stdout/status/git data back to renderer)
```

### Persistence

- `~/.mekan/projects.json` — project list with paths and settings
- `~/.mekan/layouts/` — saved pane layouts per project (JSON)

## UI Layout

Single-window, three-column layout:

```
┌──────────┬─────────────────────────────┬──────────────┐
│          │                             │              │
│ Sidebar  │     Terminal Grid           │  Git Panel   │
│ (240px)  │     (flexible)              │  (280px)     │
│          │                             │  collapsible │
│ Projects │  ┌─────────┬─────────┐     │              │
│ list     │  │ Term 1  │ Term 2  │     │ Branches     │
│          │  │         │         │     │ Worktrees    │
│ + New    │  ├─────────┼─────────┤     │ Status       │
│          │  │ Term 3  │ Term 4  │     │ History      │
│          │  │         │         │     │              │
│          │  └─────────┴─────────┘     │              │
└──────────┴─────────────────────────────┴──────────────┘
                    ┌─────────────────┐
                    │ Status Bar      │
                    └─────────────────┘
```

### Sidebar (left, 240px)

- Project list with colored initials/icons
- Each project shows: name, path (truncated), active terminal count, current git branch badge
- "+" button opens native folder picker to add a project
- Right-click context menu: rename, remove from list, open in explorer
- Drag to reorder projects
- Collapses to icon-only mode at window width <800px

### Terminal Grid (center, flexible)

- Flexible recursive split panes via `allotment`
- Each pane has a header bar: shell type icon, process status dot, close button
- Split buttons (horizontal/vertical) appear on hover of pane header
- Maximum 6 panes per project — split buttons disabled at limit
- Drag dividers to resize panes
- Minimum pane size: ~120px wide, ~80px tall
- Closing a pane expands its sibling to fill the space
- Layout stored as a binary tree of splits, persisted per project

### Git Panel (right, 280px, collapsible)

- Toggle via status bar button or keyboard shortcut
- Auto-hides below window width 1000px, accessible as overlay
- Collapsible accordion sections:
  - **Branch**: current branch, dirty/clean indicator
  - **Worktrees**: list with branch, path, status; create/delete/switch buttons
  - **Recent commits**: last 10 commits — short hash, message, author, relative time

### Status Bar (bottom)

- Current project name
- Git branch indicator
- Terminal count (e.g., "3/6 terminals")
- Git panel toggle button

## Terminal Management

### Spawning

- Each terminal spawns a `node-pty` pseudoterminal in the main process
- Default shell auto-detected from system (PowerShell on Windows)
- Working directory set to project root or active worktree path
- Each terminal has a unique ID scoped to its project

### Process Status

- Three states: `idle` (not started), `running` (process alive), `exited` (process ended)
- Visual indicator: green dot = running, red dot = exited (hover shows exit code), gray dot = idle
- Exited terminals remain open showing output; restart button appears
- User can manually close or restart any terminal

### Responsive Behavior

- `xterm-addon-fit` auto-resizes terminal cols/rows on pane resize
- IPC resize message sent to main process to update PTY dimensions

## Git Integration

### Worktree CRUD

- **List**: `git worktree list --porcelain` — displays path, branch, HEAD commit
- **Create**: dialog with branch name, optional "create new branch" checkbox; runs `git worktree add <path> <branch>`; default location: `<project-root>/../.worktrees/<project-name>/<branch>` (configurable in project settings)
- **Delete**: confirmation dialog; runs `git worktree remove <path>`; warns on uncommitted changes
- **Switch**: clicking a worktree updates the project's active working directory; new terminals use the new path; existing terminals keep their original path with a worktree badge

### Branch Overview

- All local branches listed with: name, last commit message, ahead/behind remote count, dirty indicator
- Current branch highlighted
- Shows which worktree (if any) each branch is checked out in
- Remote tracking info displayed

### Recent Commits

- Last 10 commits on current branch via `git log`
- Shows: short hash, message, relative time, author
- Click to copy full hash to clipboard

### Auto-Refresh

- Git panel refreshes on: terminal focus change, `.git/` directory watcher (chokidar), manual refresh button
- Polling fallback every 5 seconds for changes the watcher misses

## Project Structure

```
mekan-terminal/
├── package.json
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── index.ts              # App entry, window creation
│   │   ├── ipc/
│   │   │   ├── terminal.ts       # node-pty spawn/kill/resize
│   │   │   ├── git.ts            # simple-git operations
│   │   │   └── projects.ts       # project CRUD, config persistence
│   │   ├── pty-manager.ts        # PTY lifecycle management
│   │   └── config-store.ts       # Read/write ~/.mekan/ JSON files
│   ├── renderer/
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── stores/
│   │   │   ├── projects.ts       # Zustand project store
│   │   │   ├── terminals.ts      # Zustand terminal store
│   │   │   └── git.ts            # Zustand git store
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── TerminalGrid/
│   │   │   ├── TerminalPane/
│   │   │   ├── GitPanel/
│   │   │   └── StatusBar/
│   │   └── styles/
│   └── shared/
│       └── types.ts              # Types shared between main & renderer
├── resources/                    # App icons
└── tsconfig.json
```

## Packaging

- **electron-builder** with NSIS target for Windows .exe installer
- App name: "Mekan Terminal"
- Single-file installer, installs to Program Files
- Auto-update support can be added later via `electron-updater`
