# Claude Code Panel — Design Spec

## Overview

Add a Claude Code integration panel to Mekan Terminal that occupies a slot in the existing terminal grid. When the user spawns a "Claude Code" terminal, instead of rendering xterm.js, the pane renders a rich chat interface powered by the `claude` CLI in stream-json mode.

## Requirements

- Claude panel occupies a terminal grid slot (1 of 6), behaves like any other terminal
- Full Claude Code CLI capabilities (file editing, bash, read, etc.)
- Streaming responses with cancel support
- Tool use displayed as collapsible blocks (closed by default)
- Markdown rendering with syntax-highlighted code blocks
- Conversation history persisted across sessions
- Same visual design system as existing app (surface-*, zinc-*, accent)

## Architecture

### Approach: child_process + stream-json bidirectional

Spawn `claude -p --output-format stream-json --input-format stream-json --verbose --include-partial-messages` via `child_process.spawn` (not PTY). Communicate bidirectionally: stdin for user messages as JSON, stdout for structured response events.

This gives full CLI capabilities without ANSI parsing complexity.

### Stream JSON Event Types

Events emitted by the CLI (one JSON object per line):

```
{"type":"system","subtype":"init", ...}        → session metadata, tools list
{"type":"system","subtype":"hook_*", ...}      → hook events (filtered out)
{"type":"assistant","message":{content:[...]}} → response with content blocks
{"type":"result","subtype":"success", ...}     → end of response, usage stats
```

Content blocks inside assistant messages:
- `{"type":"text","text":"..."}` — markdown text
- `{"type":"tool_use","name":"Edit","input":{...}}` — tool invocation
- `{"type":"tool_result","content":"..."}` — tool output

Input format (written to stdin):
```
{"type":"user_message","message":"user's prompt here"}
```

## New Files

| File | Responsibility |
|------|---------------|
| `src/main/claude-manager.ts` | Spawn/manage claude CLI processes, parse stream JSON, IPC bridge |
| `src/main/ipc/claude.ts` | Register IPC handlers for claude operations |
| `src/renderer/components/ClaudePane/ClaudePane.tsx` | Main component — message list + input area |
| `src/renderer/components/ClaudePane/MessageBubble.tsx` | Render a single message (user or assistant) with markdown |
| `src/renderer/components/ClaudePane/ToolUseBlock.tsx` | Collapsible tool use block |
| `src/renderer/stores/claude.ts` | Zustand store — messages, streaming state, sessions |

## Modified Files

| File | Change |
|------|--------|
| `src/shared/types.ts` | Already has `'claude'` in ShellType. Add Claude IPC types, message interfaces |
| `src/main/pty-manager.ts` | Already has claude detection. No further changes needed |
| `src/main/preload.ts` | Expose claude IPC methods on `window.mekan.claude` |
| `src/main/index.ts` | Register claude IPC handlers |
| `src/renderer/components/TerminalPane/TerminalPane.tsx` | Fork: render ClaudePane when `shell === 'claude'` |
| `src/renderer/stores/terminals.ts` | Spawn via claude-manager for `shell === 'claude'` |
| `src/main/config-store.ts` | Add claude session persistence path (`~/.mekan/claude/`) |

## Data Flow

```
User types message
  → claude store dispatches
  → IPC 'claude:send' to main process
  → claude-manager writes JSON to child process stdin
  → stdout emits JSON lines (streamed)
  → main process parses each line, filters hooks
  → sends IPC 'claude:event:<terminalId>' per event
  → claude store updates messages array incrementally
  → ClaudePane re-renders with streaming content

Cancel:
  → IPC 'claude:abort' to main process
  → claude-manager kills child process
  → partial response preserved in store
  → new process spawned on next message with --resume
```

## Type Definitions

```typescript
interface ClaudeSession {
  sessionId: string;       // UUID passed to CLI --session-id
  messages: ClaudeMessage[];
  createdAt: string;
  lastMessageAt: string;
}

interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;         // markdown text
  toolUse?: ToolUseEntry[];
  timestamp: string;
  partial?: boolean;       // true while streaming
}

interface ToolUseEntry {
  tool: string;            // 'Edit', 'Bash', 'Read', etc.
  summary: string;         // 'Edited src/main.ts' or 'Ran: npm test'
  input: Record<string, unknown>;
  output?: string;
}

// IPC API additions
interface IpcApi {
  claude: {
    spawn(projectId: string, cwd: string): Promise<{ terminalId: string; sessionId: string }>;
    send(terminalId: string, message: string): void;
    abort(terminalId: string): void;
    kill(terminalId: string): void;
    onEvent(terminalId: string, callback: (event: ClaudeStreamEvent) => void): () => void;
  };
}
```

## Session Persistence

**CLI-side:** Each claude terminal gets a UUID (`crypto.randomUUID()`), passed as `--session-id <uuid>`. Claude Code persists conversation internally.

**Renderer-side:** The claude store saves rendered messages to `~/.mekan/claude/<projectId>/<terminalId>.json`. This enables instant display on reopen without waiting for CLI to load.

**Restore flow:** On app restart, `TerminalConfig` has `shell: 'claude'`. The store detects this, loads saved messages for instant display, then spawns claude with `--resume <session-id>` to reconnect to the conversation.

## UI Layout

```
┌─────────────────────────────────────────┐
│ ● Claude 1          [⟳] [■] [×]        │  header (same style as terminals)
├─────────────────────────────────────────┤
│                                         │
│  ┌─ user ─────────────────────────┐     │
│  │ Explica o que esse hook faz    │     │  user message (bg-surface-2)
│  └────────────────────────────────┘     │
│                                         │
│  ┌─ assistant ────────────────────┐     │
│  │ Esse hook usa `useEffect`...   │     │  markdown rendered
│  │                                │     │
│  │ ```typescript                  │     │  syntax-highlighted code block
│  │ useEffect(() => { ... })       │     │
│  │ ```                            │     │
│  │                                │     │
│  │ ▶ Edited src/hooks/use...ts    │     │  collapsed tool use
│  │ ▶ Ran: npm test (exit 0)      │     │  collapsed tool use
│  └────────────────────────────────┘     │
│                                         │
│  ● ● ● streaming...                    │  loading indicator
│                                         │
├─────────────────────────────────────────┤
│ > Type a message...          [⏎] [■]   │  input + send + cancel
└─────────────────────────────────────────┘
```

**Visual details:**
- User messages: `bg-surface-2`, right-aligned, plain text
- Assistant messages: no background, left-aligned, full markdown
- Tool use blocks: `bg-surface-1 border border-border rounded`, ▶/▼ toggle
- Input: `textarea` with auto-resize, `Enter` sends, `Shift+Enter` newline
- Cancel button (■) visible only during streaming
- Auto-scroll during streaming, pauses if user scrolls up

## New Dependencies

- `react-markdown` — render markdown in assistant messages
- `react-syntax-highlighter` — syntax highlighting for code blocks

## CLI Flags Reference

```bash
claude -p \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  --include-partial-messages \
  --session-id <uuid>
```

For resume: `--resume <session-id>` instead of `--session-id`.

**Implementation note:** If `--input-format stream-json` does NOT keep the process alive for multi-turn (i.e., process exits after first response), fall back to spawning a new process per message with `--resume <session-id>` to maintain conversation continuity. Both approaches produce the same user experience.

## Scope Boundaries

**In scope:**
- Claude as a terminal grid pane with rich UI
- Streaming markdown + tool use rendering
- Session persistence and resume
- Cancel mid-stream

**Out of scope (future):**
- Permission prompts UI (auto-approve or use CLI defaults)
- Image/file attachment in input
- Multiple concurrent claude sessions per project
- Custom model selection from UI
