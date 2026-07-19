# Terminal Image Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pressing `Ctrl+V` in a terminal pane while the clipboard holds a bitmap saves it as a PNG inside the project and types its path into the shell prompt, ready for the interactive `claude` CLI.

**Architecture:** A new main-process IPC handler `clipboard:paste-image(terminalId)` reads the Electron clipboard, writes a PNG to `<cwd>/.mekan/tmp/`, and returns a shell-appropriate path string. The main process resolves `cwd` and `shellType` from `pty-manager` itself, so the renderer sends only the `terminalId`. The renderer's existing `Ctrl+V` handler in `terminal-monitor.ts` is rewired to call this handler, and writes whatever string comes back to the pty — one code path for both image and text pastes.

**Tech Stack:** Electron 33 (`clipboard`, `nativeImage`), TypeScript, Node `fs`, xterm.js, Vitest (added by Task 1).

## Global Constraints

- **Language: English only.** All UI text, code comments, commit messages, and identifiers in English. No Portuguese.
- IPC channels follow the `domain:action` pattern.
- Shell types are exactly `pwsh`, `cmd`, `wsl` (`ShellType` in `src/shared/types.ts`).
- Errors degrade silently to a plain text paste — no dialogs, no popups.
- Temp files are never cleaned up automatically (explicit product decision).
- Spec: `docs/superpowers/specs/2026-07-19-terminal-image-paste-design.md`

---

### Task 1: Vitest setup + `toShellPath` pure function

This task adds the repo's first test infrastructure and the one piece of logic worth unit testing: translating a Windows path into the form the target shell understands.

**Files:**
- Modify: `package.json` (add `vitest` devDependency and `test` script)
- Create: `vitest.config.ts`
- Create: `src/main/ipc/clipboard.ts`
- Test: `src/main/ipc/clipboard.test.ts`

**Interfaces:**
- Consumes: `ShellType` from `@shared/types` (existing union: `'pwsh' | 'cmd' | 'wsl'`)
- Produces: `export function toShellPath(winPath: string, shellType: ShellType): string`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest@^3.0.0
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add after `"package"`:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

The `@shared` alias must be declared or the import in `clipboard.ts` will not resolve under Vitest.

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write the failing test**

Create `src/main/ipc/clipboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toShellPath } from './clipboard';

describe('toShellPath', () => {
  it('translates a Windows path to a WSL mount path', () => {
    expect(toShellPath('C:\\Projetos\\mekan\\x.png', 'wsl')).toBe('/mnt/c/Projetos/mekan/x.png');
  });

  it('lowercases the drive letter for WSL', () => {
    expect(toShellPath('D:\\a\\b.png', 'wsl')).toBe('/mnt/d/a/b.png');
  });

  it('leaves the path unchanged for pwsh', () => {
    expect(toShellPath('C:\\Projetos\\x.png', 'pwsh')).toBe('C:\\Projetos\\x.png');
  });

  it('leaves the path unchanged for cmd', () => {
    expect(toShellPath('C:\\Projetos\\x.png', 'cmd')).toBe('C:\\Projetos\\x.png');
  });

  it('quotes a Windows path containing a space', () => {
    expect(toShellPath('C:\\My Projects\\x.png', 'pwsh')).toBe('"C:\\My Projects\\x.png"');
  });

  it('quotes a WSL path containing a space', () => {
    expect(toShellPath('C:\\My Projects\\x.png', 'wsl')).toBe('"/mnt/c/My Projects/x.png"');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./clipboard"` (the file does not exist yet).

- [ ] **Step 6: Write the minimal implementation**

Create `src/main/ipc/clipboard.ts`:

```ts
import type { ShellType } from '@shared/types';

export function toShellPath(winPath: string, shellType: ShellType): string {
  let result = winPath;
  if (shellType === 'wsl') {
    const match = winPath.match(/^([A-Za-z]):[\\/](.*)$/);
    if (match) {
      result = `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
    }
  }
  return result.includes(' ') ? `"${result}"` : result;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 tests passing.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/main/ipc/clipboard.ts src/main/ipc/clipboard.test.ts
git commit -m "feat(clipboard): add toShellPath with vitest setup"
```

---

### Task 2: Expose terminal info from `pty-manager`

The clipboard handler needs the terminal's `cwd` and `shellType`. `pty-manager` already stores both in its private `PtyEntry` map but exports no accessor.

**Files:**
- Modify: `src/main/pty-manager.ts` (add an export near the other exports, after `getAvailableShells`)

**Interfaces:**
- Consumes: the module-private `instances: Map<string, PtyEntry>` (already defined at the top of the file)
- Produces: `export function getTerminalInfo(id: string): { cwd: string; shellType: ShellType } | null`

- [ ] **Step 1: Add the accessor**

In `src/main/pty-manager.ts`, add this function immediately after `getAvailableShells()` (around line 96):

```ts
export function getTerminalInfo(id: string): { cwd: string; shellType: ShellType } | null {
  const entry = instances.get(id);
  if (!entry) return null;
  return { cwd: entry.cwd, shellType: entry.shellType };
}
```

`ShellType` is already imported at the top of the file — no new import needed.

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (or, if the repo already has pre-existing errors, no *new* error mentioning `pty-manager.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/main/pty-manager.ts
git commit -m "feat(pty): expose getTerminalInfo accessor"
```

---

### Task 3: Clipboard IPC handler

Fills in the rest of `src/main/ipc/clipboard.ts`: read the clipboard, save the PNG, keep `.gitignore` tidy, and register the handler.

**Files:**
- Modify: `src/main/ipc/clipboard.ts` (add imports, helpers, and `register()`)
- Modify: `src/main/index.ts` (import and call `clipboardIpc.register()`)

**Interfaces:**
- Consumes: `toShellPath` (Task 1), `getTerminalInfo` (Task 2)
- Produces: IPC channel `clipboard:paste-image`, returning
  `{ kind: 'text'; text: string } | { kind: 'image'; text: string } | null`

- [ ] **Step 1: Add the imports at the top of `src/main/ipc/clipboard.ts`**

Place these **above** the existing `import type { ShellType }` line:

```ts
import { ipcMain, clipboard } from 'electron';
import fs from 'fs';
import path from 'path';
import * as ptyManager from '../pty-manager';
```

- [ ] **Step 2: Add the `.gitignore` helper below `toShellPath`**

Best-effort only: any failure here must not prevent the paste.

```ts
function ensureGitignored(cwd: string) {
  try {
    const gitignorePath = path.join(cwd, '.gitignore');
    const existing = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, 'utf-8')
      : '';
    const hasEntry = existing
      .split(/\r?\n/)
      .some((line) => line.trim() === '.mekan/' || line.trim() === '.mekan');
    if (hasEntry) return;
    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(gitignorePath, `${prefix}.mekan/\n`);
  } catch {
    // best effort — never block the paste
  }
}
```

- [ ] **Step 3: Add the handler registration at the bottom of the file**

```ts
export function register() {
  ipcMain.handle('clipboard:paste-image', async (_event, terminalId: string) => {
    const info = ptyManager.getTerminalInfo(terminalId);
    if (!info) return null;

    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return { kind: 'text' as const, text: clipboard.readText() };
    }

    try {
      const tmpDir = path.join(info.cwd, '.mekan', 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, `paste-${Date.now()}.png`);
      fs.writeFileSync(filePath, image.toPNG());
      ensureGitignored(info.cwd);
      return { kind: 'image' as const, text: `${toShellPath(filePath, info.shellType)} ` };
    } catch {
      return { kind: 'text' as const, text: clipboard.readText() };
    }
  });
}
```

The trailing space after the path lets the user keep typing their question immediately.

- [ ] **Step 4: Register the module in `src/main/index.ts`**

Add the import alongside the other IPC imports (after line 11):

```ts
import * as clipboardIpc from './ipc/clipboard';
```

Add the call alongside the other `register()` calls (after `claudeUsageIpc.register();`, around line 104):

```ts
  clipboardIpc.register();
```

- [ ] **Step 5: Verify the unit tests still pass and it builds**

Run: `npm test && npm run build:main`
Expected: 6 tests PASS, build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/clipboard.ts src/main/index.ts
git commit -m "feat(clipboard): add paste-image IPC handler"
```

---

### Task 4: Wire `Ctrl+V` in the renderer

`terminal-monitor.ts` already intercepts `Ctrl+V` and pastes text via `navigator.clipboard.readText()`. Replace that body with a call to the new handler so image and text pastes share one path.

**Files:**
- Modify: `src/shared/types.ts:163-172` (add `pasteImage` to the `terminal` block of `IpcApi`)
- Modify: `src/main/preload.ts:26-32` (add the `pasteImage` bridge)
- Modify: `src/renderer/stores/terminal-monitor.ts:99-108` (rewrite the `Ctrl+V` branch)

**Interfaces:**
- Consumes: IPC channel `clipboard:paste-image` (Task 3)
- Produces: `window.mekan.terminal.pasteImage(terminalId): Promise<PasteResult>`

- [ ] **Step 1: Add the `PasteResult` type to `src/shared/types.ts`**

Place it just above the `IpcApi` interface:

```ts
export type PasteResult =
  | { kind: 'text'; text: string }
  | { kind: 'image'; text: string }
  | null;
```

- [ ] **Step 2: Add `pasteImage` to the `terminal` block of `IpcApi`**

In `src/shared/types.ts`, add after the `restart` line (line 169):

```ts
    pasteImage(terminalId: string): Promise<PasteResult>;
```

- [ ] **Step 3: Add the preload bridge**

In `src/main/preload.ts`, inside the `terminal: { ... }` object, add after the `restart` line (line 32):

```ts
    pasteImage: (terminalId: string) => ipcRenderer.invoke('clipboard:paste-image', terminalId),
```

- [ ] **Step 4: Rewrite the `Ctrl+V` branch in `terminal-monitor.ts`**

Replace this existing block (lines 99-108):

```ts
  term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      if (e.type === 'keydown') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text) term.paste(text);
        });
      }
      return false;
    }
```

with:

```ts
  term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      if (e.type === 'keydown') {
        e.preventDefault();
        window.mekan.terminal.pasteImage(terminalId).then((result) => {
          if (result?.text) term.paste(result.text);
        });
      }
      return false;
    }
```

`term.paste()` is used for both cases so bracketed-paste mode is honored exactly as before.

- [ ] **Step 5: Verify it typechecks and builds**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: no new errors, both main and renderer builds complete.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/preload.ts src/renderer/stores/terminal-monitor.ts
git commit -m "feat(terminal): paste clipboard images as file paths"
```

---

### Task 5: Manual verification in the app

Automated tests cannot cover the Electron clipboard or the `claude` CLI's behavior. This task is the real acceptance gate.

**Files:** none — verification only.

- [ ] **Step 1: Start the app**

Run: `npm run dev`

- [ ] **Step 2: Verify text paste did not regress**

Copy any text, click into a `pwsh` pane, press `Ctrl+V`.
Expected: the text appears at the prompt exactly as before this change.

- [ ] **Step 3: Verify image paste in a WSL pane**

Take a screenshot with `Win+Shift+S`, click into a WSL pane, press `Ctrl+V`.
Expected: a path like `/mnt/c/Projetos/mekan-terminal/.mekan/tmp/paste-1770000000000.png ` appears at the prompt, with a trailing space and no `Enter` sent.

- [ ] **Step 4: Verify the file and gitignore**

Run: `ls .mekan/tmp/ && grep -n "^\.mekan/$" .gitignore && git status --short`
Expected: the PNG exists, `.gitignore` contains `.mekan/`, and `git status` does **not** list the PNG as untracked.

- [ ] **Step 5: Verify image paste in a pwsh pane**

Repeat Step 3 in a `pwsh` pane.
Expected: a Windows-style path (`C:\Projetos\...\paste-....png `) appears.

- [ ] **Step 6: Verify Claude actually reads the image**

In a pane running `claude` interactively, paste an image and send `what is in this image?`.
Expected: Claude describes the image.

If the CLI does **not** attach the image from a bare path, this is the spec's known open item. The fallback is already usable — ask "read this image" and the Read tool handles it. Record which behavior occurred in the commit message or a follow-up note; do not change the design without checking with the user.

- [ ] **Step 7: Commit any fixes found during verification**

Only if Steps 2-6 surfaced defects. Otherwise no commit — the feature is done.
