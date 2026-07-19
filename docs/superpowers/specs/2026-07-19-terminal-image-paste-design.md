# Terminal Image Paste — Design

**Date:** 2026-07-19

## Problem

To show Claude Code a screenshot today, the user must save the image to a file manually, then type its path into the terminal. Screenshots taken with a crop tool live only in the clipboard, so every image costs a save-file detour.

## Goal

Pressing `Ctrl+V` in a terminal pane while the clipboard holds a bitmap writes a saved PNG's path into the shell prompt, ready to be sent to the interactive `claude` CLI. Everything is local — no upload.

## Scope

In scope: the xterm terminal panes (`pwsh`, `cmd`, `wsl`).

Out of scope (YAGNI):
- Temp file cleanup — files accumulate in `.mekan/tmp/` and the user manages them.
- Thumbnail or preview of the pasted image.
- Pasting image *files* copied from Explorer (clipboard bitmap only).
- Any ClaudePane integration — that pane is no longer in active use.

## Architecture

### Main process — `src/main/ipc/clipboard.ts` (new)

One handler: `clipboard:paste-image(terminalId)`.

The main process already owns the terminal's `cwd` and `shellType` in `pty-manager`, so the renderer sends only the `terminalId`. No shell or path plumbing crosses the IPC boundary.

Handler flow:

1. Resolve the terminal from `pty-manager`. If it no longer exists, return `null`.
2. `clipboard.readImage()`. If `isEmpty()`, return `{ kind: 'text', text: clipboard.readText() }`.
3. Otherwise `img.toPNG()` and write to `<cwd>/.mekan/tmp/paste-<timestamp>.png`, creating the directory if needed.
4. Ensure `.mekan/` is listed in the project's `.gitignore`. Append the line only if absent.
5. Translate the path for the shell via `toShellPath(winPath, shellType)`.
6. Return `{ kind: 'image', text: '<path> ' }` — the trailing space lets the user keep typing their question.

Return type:

```ts
type PasteResult =
  | { kind: 'text'; text: string }
  | { kind: 'image'; text: string }
  | null;
```

### Path translation — `toShellPath(winPath, shellType)`

A pure exported function, testable without Electron.

- `wsl` → `C:\Projetos\x.png` becomes `/mnt/c/Projetos/x.png` (drive letter lowercased, backslashes to forward slashes).
- `pwsh` / `cmd` → the Windows path unchanged.
- Any path containing a space is wrapped in double quotes.

### Renderer — `src/renderer/stores/terminal-monitor.ts`

Where the xterm instance is created, `attachCustomKeyEventHandler` intercepts `Ctrl+V` and returns `false`, taking over from xterm's default paste. It then calls the IPC handler; whether the result is `text` or `image`, the returned string goes to the pty through `window.mekan.terminal.write()`.

Single code path for both cases — no chance of a double paste.

### Preload — `src/main/preload.ts`

Add to the existing `terminal` namespace:

```ts
pasteImage: (terminalId: string) => ipcRenderer.invoke('clipboard:paste-image', terminalId)
```

## Error handling

Degrade silently; no dialogs.

- PNG write fails (disk full, permission): fall back to `readText()` so `Ctrl+V` behaves as it always has.
- `.gitignore` missing or unwritable: best-effort only — the image is still saved and the paste still works.
- Unknown `terminalId`: return `null` and the renderer writes nothing.

## Testing

Unit tests cover `toShellPath` only:
- `C:\Projetos\x.png` + `wsl` → `/mnt/c/Projetos/x.png`
- lowercase drive letter handled
- path with a space → wrapped in quotes
- `pwsh` returns the path unchanged

Manual verification in the app: Win+Shift+S crop → `Ctrl+V` in a WSL pane → correct path appears at the `claude` prompt → ask "what is in this image?" and confirm Claude sees it.

## Open item

The interactive `claude` CLI is expected to attach an image from a bare path in the prompt; this was not verified while writing the spec. If it does not, the path simply reads as text and the user can write "read this image" — the Read tool handles it. Confirm during implementation.
