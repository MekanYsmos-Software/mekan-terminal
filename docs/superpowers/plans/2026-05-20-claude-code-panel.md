# Claude Code Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich Claude Code chat panel that occupies a terminal grid slot, powered by the `claude` CLI in stream-json mode.

**Architecture:** Spawn `claude -p --output-format stream-json --input-format stream-json --verbose --include-partial-messages` as a child process (not PTY). Main process parses JSON lines and bridges events via IPC. Renderer shows a chat UI with markdown, syntax-highlighted code blocks, and collapsible tool use blocks.

**Tech Stack:** Electron child_process, React, Zustand, react-markdown, react-syntax-highlighter, Tailwind CSS

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-markdown and react-syntax-highlighter**

Run:
```bash
npm install react-markdown react-syntax-highlighter
npm install -D @types/react-syntax-highlighter
```

- [ ] **Step 2: Verify install**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown and react-syntax-highlighter dependencies"
```

---

### Task 2: Add shared types for Claude IPC

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add Claude message and event types to types.ts**

Add after the `TerminalConfig` interface (around line 42):

```typescript
export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUse?: ToolUseEntry[];
  timestamp: string;
  partial?: boolean;
}

export interface ToolUseEntry {
  tool: string;
  summary: string;
  input: Record<string, unknown>;
  output?: string;
}

export interface ClaudeSession {
  sessionId: string;
  messages: ClaudeMessage[];
  createdAt: string;
  lastMessageAt: string;
}

export type ClaudeStreamEvent =
  | { type: 'init'; sessionId: string; tools: string[] }
  | { type: 'text'; text: string; partial: boolean }
  | { type: 'tool_use'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; output: string }
  | { type: 'done'; cost?: number; duration?: number }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: Add claude IPC API to the IpcApi interface**

Add inside the `IpcApi` interface, after the `shell` section:

```typescript
claude: {
  spawn(projectId: string, cwd: string, sessionId?: string): Promise<string>;
  send(terminalId: string, message: string): void;
  abort(terminalId: string): void;
  kill(terminalId: string): void;
  onEvent(terminalId: string, callback: (event: ClaudeStreamEvent) => void): () => void;
};
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add Claude message and IPC types"
```

---

### Task 3: Create claude-manager.ts (main process)

**Files:**
- Create: `src/main/claude-manager.ts`

- [ ] **Step 1: Create the claude manager module**

```typescript
import { spawn as cpSpawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import { findClaude } from './pty-manager';
import readline from 'readline';

interface ClaudeEntry {
  id: string;
  projectId: string;
  process: ChildProcess;
  sessionId: string;
  cwd: string;
  status: 'idle' | 'streaming' | 'dead';
}

const instances = new Map<string, ClaudeEntry>();
let counter = 0;

export function spawnClaude(
  projectId: string,
  cwd: string,
  win: BrowserWindow,
  resumeSessionId?: string
): string {
  const id = `claude-${++counter}`;
  const claudePath = findClaude();
  if (!claudePath) throw new Error('Claude CLI not found');

  const sessionId = resumeSessionId || crypto.randomUUID();
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
  ];

  if (resumeSessionId) {
    args.push('--resume', resumeSessionId);
  } else {
    args.push('--session-id', sessionId);
  }

  const proc = cpSpawn(claudePath, args, {
    cwd,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const entry: ClaudeEntry = {
    id,
    projectId,
    process: proc,
    sessionId,
    cwd,
    status: 'idle',
  };

  const rl = readline.createInterface({ input: proc.stdout! });

  rl.on('line', (line) => {
    if (win.isDestroyed()) return;
    try {
      const event = JSON.parse(line);
      if (event.type === 'system' && event.subtype?.startsWith('hook')) return;

      if (event.type === 'assistant') {
        entry.status = 'streaming';
        const content = event.message?.content;
        if (!content || !Array.isArray(content)) return;

        for (const block of content) {
          if (block.type === 'text') {
            win.webContents.send(`claude:event:${id}`, {
              type: 'text',
              text: block.text,
              partial: !event.message.stop_reason,
            });
          } else if (block.type === 'tool_use') {
            win.webContents.send(`claude:event:${id}`, {
              type: 'tool_use',
              tool: block.name,
              input: block.input,
            });
          } else if (block.type === 'tool_result') {
            win.webContents.send(`claude:event:${id}`, {
              type: 'tool_result',
              tool: block.name || '',
              output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
            });
          }
        }
      } else if (event.type === 'system' && event.subtype === 'init') {
        win.webContents.send(`claude:event:${id}`, {
          type: 'init',
          sessionId: event.session_id || sessionId,
          tools: event.tools || [],
        });
      } else if (event.type === 'result') {
        entry.status = 'idle';
        win.webContents.send(`claude:event:${id}`, {
          type: 'done',
          cost: event.total_cost_usd,
          duration: event.duration_ms,
        });
      }
    } catch {
      // malformed JSON line, skip
    }
  });

  proc.on('exit', () => {
    entry.status = 'dead';
    if (!win.isDestroyed()) {
      win.webContents.send(`claude:event:${id}`, {
        type: 'error',
        message: 'Claude process exited',
      });
    }
  });

  proc.stderr?.on('data', () => {
    // discard stderr noise
  });

  instances.set(id, entry);
  return id;
}

export function sendMessage(id: string, message: string) {
  const entry = instances.get(id);
  if (!entry || entry.status === 'dead') return;
  const payload = JSON.stringify({ type: 'user_message', message }) + '\n';
  entry.process.stdin?.write(payload);
  entry.status = 'streaming';
}

export function abort(id: string) {
  const entry = instances.get(id);
  if (!entry) return;
  try {
    entry.process.kill('SIGTERM');
  } catch {
    // already dead
  }
  entry.status = 'dead';
}

export function kill(id: string) {
  const entry = instances.get(id);
  if (entry) {
    try {
      entry.process.kill('SIGKILL');
    } catch {
      // already dead
    }
  }
  instances.delete(id);
}

export function getSessionId(id: string): string | null {
  return instances.get(id)?.sessionId ?? null;
}

export function killAll() {
  for (const [id] of instances) {
    kill(id);
  }
}
```

- [ ] **Step 2: Export findClaude from pty-manager**

In `src/main/pty-manager.ts`, the `findClaude` function is currently not exported. Add `export` to the function declaration at line ~75:

Change `function findClaude()` to `export function findClaude()`.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/claude-manager.ts src/main/pty-manager.ts
git commit -m "feat: add claude-manager for child process lifecycle and stream parsing"
```

---

### Task 4: Create claude IPC handlers

**Files:**
- Create: `src/main/ipc/claude.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create the IPC handler module**

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import * as claudeManager from '../claude-manager';

export function register() {
  ipcMain.handle('claude:spawn', (event, projectId: string, cwd: string, sessionId?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return claudeManager.spawnClaude(projectId, cwd, win, sessionId);
  });

  ipcMain.on('claude:send', (_event, terminalId: string, message: string) => {
    claudeManager.sendMessage(terminalId, message);
  });

  ipcMain.on('claude:abort', (_event, terminalId: string) => {
    claudeManager.abort(terminalId);
  });

  ipcMain.on('claude:kill', (_event, terminalId: string) => {
    claudeManager.kill(terminalId);
  });
}
```

- [ ] **Step 2: Register claude IPC in index.ts**

In `src/main/index.ts`, add the import at the top with the other imports:

```typescript
import * as claudeIpc from './ipc/claude';
import * as claudeManager from './claude-manager';
```

Inside `app.whenReady().then(...)`, after `filesIpc.register();`, add:

```typescript
claudeIpc.register();
```

In the `before-quit` handler, add `claudeManager.killAll();` after `ptyManager.killAll();`.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/claude.ts src/main/index.ts
git commit -m "feat: add claude IPC handlers and register in main process"
```

---

### Task 5: Add claude IPC to preload bridge

**Files:**
- Modify: `src/main/preload.ts`

- [ ] **Step 1: Add claude namespace to the preload API**

In `src/main/preload.ts`, add the `claude` section inside the `api` object, after the `shell` section (around line 73):

```typescript
claude: {
  spawn: (projectId: string, cwd: string, sessionId?: string) =>
    ipcRenderer.invoke('claude:spawn', projectId, cwd, sessionId),
  send: (terminalId: string, message: string) =>
    ipcRenderer.send('claude:send', terminalId, message),
  abort: (terminalId: string) =>
    ipcRenderer.send('claude:abort', terminalId),
  kill: (terminalId: string) =>
    ipcRenderer.send('claude:kill', terminalId),
  onEvent: (terminalId: string, callback: (event: import('@shared/types').ClaudeStreamEvent) => void) => {
    const channel = `claude:event:${terminalId}`;
    const listener = (_event: Electron.IpcRendererEvent, data: import('@shared/types').ClaudeStreamEvent) =>
      callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
},
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/preload.ts
git commit -m "feat: expose claude IPC methods in preload bridge"
```

---

### Task 6: Create claude Zustand store

**Files:**
- Create: `src/renderer/stores/claude.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';
import type { ClaudeMessage, ClaudeStreamEvent, ToolUseEntry } from '@shared/types';

interface ClaudeTerminalState {
  messages: ClaudeMessage[];
  streaming: boolean;
  sessionId: string | null;
  currentText: string;
  currentToolUse: ToolUseEntry[];
}

interface ClaudeState {
  sessions: Record<string, ClaudeTerminalState>;

  initSession(terminalId: string, sessionId: string): void;
  addUserMessage(terminalId: string, content: string): void;
  handleEvent(terminalId: string, event: ClaudeStreamEvent): void;
  clearSession(terminalId: string): void;
  getSession(terminalId: string): ClaudeTerminalState | null;
}

function defaultSession(): ClaudeTerminalState {
  return { messages: [], streaming: false, sessionId: null, currentText: '', currentToolUse: [] };
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  sessions: {},

  initSession(terminalId, sessionId) {
    set((s) => ({
      sessions: {
        ...s.sessions,
        [terminalId]: { ...defaultSession(), sessionId },
      },
    }));
  },

  addUserMessage(terminalId, content) {
    const session = get().sessions[terminalId];
    if (!session) return;
    const msg: ClaudeMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      sessions: {
        ...s.sessions,
        [terminalId]: {
          ...s.sessions[terminalId],
          messages: [...s.sessions[terminalId].messages, msg],
          streaming: true,
          currentText: '',
          currentToolUse: [],
        },
      },
    }));
  },

  handleEvent(terminalId, event) {
    const session = get().sessions[terminalId];
    if (!session) return;

    switch (event.type) {
      case 'init':
        set((s) => ({
          sessions: {
            ...s.sessions,
            [terminalId]: { ...s.sessions[terminalId], sessionId: event.sessionId },
          },
        }));
        break;

      case 'text':
        set((s) => ({
          sessions: {
            ...s.sessions,
            [terminalId]: {
              ...s.sessions[terminalId],
              currentText: event.text,
            },
          },
        }));
        break;

      case 'tool_use':
        set((s) => {
          const sess = s.sessions[terminalId];
          const entry: ToolUseEntry = {
            tool: event.tool,
            summary: formatToolSummary(event.tool, event.input),
            input: event.input,
          };
          return {
            sessions: {
              ...s.sessions,
              [terminalId]: {
                ...sess,
                currentToolUse: [...sess.currentToolUse, entry],
              },
            },
          };
        });
        break;

      case 'tool_result':
        set((s) => {
          const sess = s.sessions[terminalId];
          const toolUse = [...sess.currentToolUse];
          const last = toolUse.findLast((t) => t.tool === event.tool && !t.output);
          if (last) last.output = event.output;
          return {
            sessions: {
              ...s.sessions,
              [terminalId]: { ...sess, currentToolUse: toolUse },
            },
          };
        });
        break;

      case 'done':
        set((s) => {
          const sess = s.sessions[terminalId];
          const msg: ClaudeMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: sess.currentText,
            toolUse: sess.currentToolUse.length > 0 ? sess.currentToolUse : undefined,
            timestamp: new Date().toISOString(),
          };
          return {
            sessions: {
              ...s.sessions,
              [terminalId]: {
                ...sess,
                messages: [...sess.messages, msg],
                streaming: false,
                currentText: '',
                currentToolUse: [],
              },
            },
          };
        });
        break;

      case 'error':
        set((s) => {
          const sess = s.sessions[terminalId];
          return {
            sessions: {
              ...s.sessions,
              [terminalId]: { ...sess, streaming: false },
            },
          };
        });
        break;
    }
  },

  clearSession(terminalId) {
    set((s) => {
      const { [terminalId]: _, ...rest } = s.sessions;
      return { sessions: rest };
    });
  },

  getSession(terminalId) {
    return get().sessions[terminalId] ?? null;
  },
}));

function formatToolSummary(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'Edit':
    case 'Write':
      return `${tool}: ${input.file_path || 'unknown file'}`;
    case 'Read':
      return `Read: ${input.file_path || 'unknown file'}`;
    case 'Bash':
      return `Ran: ${(input.command as string)?.slice(0, 60) || 'command'}`;
    case 'Glob':
      return `Glob: ${input.pattern || 'pattern'}`;
    case 'Grep':
      return `Grep: ${input.pattern || 'pattern'}`;
    default:
      return tool;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/claude.ts
git commit -m "feat: add claude Zustand store for message and stream state management"
```

---

### Task 7: Create ToolUseBlock component

**Files:**
- Create: `src/renderer/components/ClaudePane/ToolUseBlock.tsx`

- [ ] **Step 1: Create the collapsible tool use block**

```typescript
import { useState } from 'react';
import type { ToolUseEntry } from '@shared/types';

interface Props {
  entry: ToolUseEntry;
}

export default function ToolUseBlock({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5 rounded-md border border-border bg-surface-1 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 transition-colors"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-mono text-xxs text-accent/70">{entry.tool}</span>
        <span className="truncate">{entry.summary}</span>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 text-xxs font-mono text-zinc-500 max-h-60 overflow-auto">
          {entry.output ? (
            <pre className="whitespace-pre-wrap break-all">{entry.output.slice(0, 2000)}</pre>
          ) : (
            <pre className="whitespace-pre-wrap break-all text-zinc-600">
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/ClaudePane/ToolUseBlock.tsx
git commit -m "feat: add ToolUseBlock collapsible component"
```

---

### Task 8: Create MessageBubble component

**Files:**
- Create: `src/renderer/components/ClaudePane/MessageBubble.tsx`

- [ ] **Step 1: Create the message bubble with markdown rendering**

```typescript
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ClaudeMessage } from '@shared/types';
import ToolUseBlock from './ToolUseBlock';

interface Props {
  message: ClaudeMessage;
}

export default function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] bg-surface-2 rounded-lg px-3 py-2 text-sm text-zinc-200 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="text-sm text-zinc-300 claude-markdown">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const code = String(children).replace(/\n$/, '');
              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: '0.5rem 0',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      background: 'var(--color-surface-2, #1a1a1e)',
                    }}
                  >
                    {code}
                  </SyntaxHighlighter>
                );
              }
              return (
                <code className="bg-surface-2 px-1.5 py-0.5 rounded text-xs text-accent font-mono" {...props}>
                  {children}
                </code>
              );
            },
            p({ children }) {
              return <p className="mb-2 leading-relaxed">{children}</p>;
            },
            ul({ children }) {
              return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
            },
            h1({ children }) {
              return <h1 className="text-base font-semibold text-zinc-100 mb-2 mt-3">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-sm font-semibold text-zinc-100 mb-2 mt-3">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-sm font-medium text-zinc-200 mb-1 mt-2">{children}</h3>;
            },
            blockquote({ children }) {
              return <blockquote className="border-l-2 border-accent/30 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>;
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {message.toolUse?.map((entry, i) => (
        <ToolUseBlock key={i} entry={entry} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ClaudePane/MessageBubble.tsx
git commit -m "feat: add MessageBubble with markdown rendering and syntax highlighting"
```

---

### Task 9: Create ClaudePane component

**Files:**
- Create: `src/renderer/components/ClaudePane/ClaudePane.tsx`

- [ ] **Step 1: Create the main claude pane component**

```typescript
import { useEffect, useRef, useState } from 'react';
import { useClaudeStore } from '../../stores/claude';
import MessageBubble from './MessageBubble';
import type { ClaudeMessage } from '@shared/types';

interface Props {
  terminalId: string;
  projectId: string;
  cwd: string;
}

export default function ClaudePane({ terminalId, projectId, cwd }: Props) {
  const session = useClaudeStore((s) => s.sessions[terminalId]);
  const initSession = useClaudeStore((s) => s.initSession);
  const addUserMessage = useClaudeStore((s) => s.addUserMessage);
  const handleEvent = useClaudeStore((s) => s.handleEvent);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (session) return;

    let mounted = true;
    (async () => {
      const id = await window.mekan.claude.spawn(projectId, cwd);
      if (!mounted) return;
      initSession(terminalId, id);

      const unsub = window.mekan.claude.onEvent(id, (event) => {
        handleEvent(terminalId, event);
      });
      cleanupRef.current = unsub;
    })();

    return () => {
      mounted = false;
    };
  }, [terminalId, projectId, cwd]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, session?.currentText, userScrolled]);

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setUserScrolled(!nearBottom);
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !session || session.streaming) return;
    addUserMessage(terminalId, trimmed);
    window.mekan.claude.send(session.sessionId!, trimmed);
    setInput('');
    setUserScrolled(false);
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, 0);
  }

  function handleAbort() {
    if (!session?.sessionId) return;
    window.mekan.claude.abort(session.sessionId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-3 h-3 rounded-full border-[1.5px] border-accent/40 border-t-accent animate-spin" />
          Starting Claude Code...
        </div>
      </div>
    );
  }

  const streamingMessage: ClaudeMessage | null = session.streaming && session.currentText
    ? {
        id: 'streaming',
        role: 'assistant',
        content: session.currentText,
        toolUse: session.currentToolUse.length > 0 ? session.currentToolUse : undefined,
        timestamp: new Date().toISOString(),
        partial: true,
      }
    : null;

  return (
    <div className="flex flex-col h-full">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
        onScroll={handleScroll}
      >
        {session.messages.length === 0 && !streamingMessage && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-zinc-600 text-sm">
              <div className="text-lg mb-1">Claude Code</div>
              <div className="text-xs">Send a message to start</div>
            </div>
          </div>
        )}
        {session.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streamingMessage && <MessageBubble message={streamingMessage} />}
        {session.streaming && !session.currentText && (
          <div className="flex items-center gap-1.5 py-2 text-zinc-500">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-border bg-surface-1 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-surface-2 text-sm text-zinc-200 placeholder-zinc-600 rounded-lg px-3 py-2 outline-none border border-border focus:border-accent/50 resize-none transition-colors"
            disabled={session.streaming}
          />
          {session.streaming ? (
            <button
              onClick={handleAbort}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Cancel"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send (Enter)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ClaudePane/ClaudePane.tsx
git commit -m "feat: add ClaudePane main component with chat UI and streaming"
```

---

### Task 10: Integrate ClaudePane into TerminalPane

**Files:**
- Modify: `src/renderer/components/TerminalPane/TerminalPane.tsx`

- [ ] **Step 1: Fork rendering based on shell type**

In `TerminalPane.tsx`, add the import at the top:

```typescript
import ClaudePane from '../ClaudePane/ClaudePane';
```

Then, replace the terminal container div (the last element in the return, around line 306-309):

```tsx
<div
  ref={containerRef}
  className={`flex-1 min-h-0 overflow-hidden transition-shadow duration-150 ${dropHighlight ? 'ring-1 ring-inset ring-accent/50' : ''}`}
/>
```

With a conditional render:

```tsx
{terminal?.shell === 'claude' ? (
  <ClaudePane terminalId={terminalId} projectId={projectId} cwd={cwd} />
) : (
  <div
    ref={containerRef}
    className={`flex-1 min-h-0 overflow-hidden transition-shadow duration-150 ${dropHighlight ? 'ring-1 ring-inset ring-accent/50' : ''}`}
  />
)}
```

- [ ] **Step 2: Hide terminal-specific header buttons for claude panes**

In the hovered toolbar section (around line 221-238), wrap the claude/compact/clear shortcuts in a conditional so they only show for non-claude terminals:

```tsx
{hovered && !editing && status === 'running' && terminal?.shell !== 'claude' && (
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/TerminalPane/TerminalPane.tsx
git commit -m "feat: render ClaudePane inside TerminalPane when shell is claude"
```

---

### Task 11: Wire up terminal store for claude spawning

**Files:**
- Modify: `src/renderer/stores/terminals.ts`

- [ ] **Step 1: Handle claude shell type in spawnTerminal**

In `src/renderer/stores/terminals.ts`, the `spawnTerminal` method currently always calls `window.mekan.terminal.spawn`. For `shell === 'claude'`, we need to skip the PTY spawn and just create the terminal instance (the actual claude process is spawned by ClaudePane on mount).

Replace line 71 (`const id = await window.mekan.terminal.spawn(projectId, cwd, shell);`) with:

```typescript
let id: string;
if (shell === 'claude') {
  id = `claude-ui-${Date.now()}`;
} else {
  id = await window.mekan.terminal.spawn(projectId, cwd, shell);
}
```

- [ ] **Step 2: Handle claude in removeTerminal**

In `removeTerminal`, add a claude kill before the PTY kill (around line 121):

```typescript
removeTerminal(projectId, terminalId) {
  destroyTerminal(terminalId);
  if (terminalId.startsWith('claude-ui-')) {
    window.mekan.claude.kill(terminalId);
  } else {
    window.mekan.terminal.kill(terminalId);
  }
```

Wait — the claude process ID is different from the terminal UI ID. The ClaudePane spawns the actual claude process and gets back a `claude-N` ID from claude-manager, but the terminal store uses `claude-ui-TIMESTAMP`. We need to track this mapping.

Actually, let's simplify: have `spawnTerminal` for claude call `window.mekan.claude.spawn` directly and use the returned ID as the terminal ID. This way the IDs are consistent.

Replace the change from Step 1 with:

```typescript
let id: string;
if (shell === 'claude') {
  id = await window.mekan.claude.spawn(projectId, cwd);
} else {
  id = await window.mekan.terminal.spawn(projectId, cwd, shell);
}
```

And update `removeTerminal` to handle both:

```typescript
removeTerminal(projectId, terminalId) {
  destroyTerminal(terminalId);
  const terminal = (get().terminals[projectId] || []).find((t) => t.id === terminalId);
  if (terminal?.shell === 'claude') {
    window.mekan.claude.kill(terminalId);
  } else {
    window.mekan.terminal.kill(terminalId);
  }
  const updated = (get().terminals[projectId] || []).filter((t) => t.id !== terminalId);
  set((s) => ({
    terminals: { ...s.terminals, [projectId]: updated },
  }));
  saveLayout(projectId, updated);
},
```

- [ ] **Step 3: Update ClaudePane to use the terminal ID directly**

Since the terminal store now spawns the claude process and the terminal ID IS the claude process ID, update `ClaudePane.tsx` to NOT spawn its own process. Instead, it should just set up the event listener using the terminalId it receives:

Replace the spawn useEffect with:

```typescript
useEffect(() => {
  if (!session) {
    initSession(terminalId, terminalId);
  }

  const unsub = window.mekan.claude.onEvent(terminalId, (event) => {
    handleEvent(terminalId, event);
  });
  cleanupRef.current = unsub;

  return () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  };
}, [terminalId]);
```

Remove the second cleanup useEffect (it's now handled in the one above).

Update `handleSend` to use `terminalId` instead of `session.sessionId`:

```typescript
function handleSend() {
  const trimmed = input.trim();
  if (!trimmed || !session || session.streaming) return;
  addUserMessage(terminalId, trimmed);
  window.mekan.claude.send(terminalId, trimmed);
  setInput('');
  setUserScrolled(false);
  setTimeout(() => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, 0);
}

function handleAbort() {
  window.mekan.claude.abort(terminalId);
}
```

Remove the loading state (no longer needed since the process is already spawned):

Replace the `if (!session)` loading block with:

```typescript
if (!session) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-zinc-600 text-sm">
        <div className="text-lg mb-1">Claude Code</div>
        <div className="text-xs">Send a message to start</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stores/terminals.ts src/renderer/components/ClaudePane/ClaudePane.tsx
git commit -m "feat: wire claude spawning through terminal store with consistent IDs"
```

---

### Task 12: Add session persistence

**Files:**
- Modify: `src/main/config-store.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add claude session storage to config-store**

In `src/main/config-store.ts`, add after the `TASKS_DIR` line (line 9):

```typescript
const CLAUDE_DIR = path.join(MEKAN_DIR, 'claude');
```

In the `init()` function, add:

```typescript
ensureDir(CLAUDE_DIR);
```

Add these functions at the end of the file:

```typescript
export function readClaudeSession(projectId: string, terminalId: string): unknown | null {
  const dir = path.join(CLAUDE_DIR, projectId);
  const file = path.join(dir, `${terminalId}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

export function writeClaudeSession(projectId: string, terminalId: string, session: unknown) {
  const dir = path.join(CLAUDE_DIR, projectId);
  ensureDir(dir);
  const file = path.join(dir, `${terminalId}.json`);
  fs.writeFileSync(file, JSON.stringify(session, null, 2), 'utf-8');
}
```

- [ ] **Step 2: Add IPC handlers for claude session persistence**

In `src/main/ipc/claude.ts`, add at the end of the `register()` function:

```typescript
ipcMain.handle('claude:session:load', (_event, projectId: string, terminalId: string) => {
  return configStore.readClaudeSession(projectId, terminalId);
});

ipcMain.handle('claude:session:save', (_event, projectId: string, terminalId: string, session: unknown) => {
  configStore.writeClaudeSession(projectId, terminalId, session);
});
```

Add the import at the top of the file:

```typescript
import * as configStore from '../config-store';
```

- [ ] **Step 3: Expose session persistence in preload**

Add inside the `claude` section of the preload API:

```typescript
loadSession: (projectId: string, terminalId: string) =>
  ipcRenderer.invoke('claude:session:load', projectId, terminalId),
saveSession: (projectId: string, terminalId: string, session: unknown) =>
  ipcRenderer.invoke('claude:session:save', projectId, terminalId, session),
```

- [ ] **Step 4: Add the session persistence methods to IpcApi types**

In `src/shared/types.ts`, add inside the `claude` section of `IpcApi`:

```typescript
loadSession(projectId: string, terminalId: string): Promise<ClaudeSession | null>;
saveSession(projectId: string, terminalId: string, session: ClaudeSession): Promise<void>;
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/config-store.ts src/main/ipc/claude.ts src/main/preload.ts src/shared/types.ts
git commit -m "feat: add claude session persistence to config store and IPC"
```

---

### Task 13: End-to-end testing

**Files:** None (manual testing)

- [ ] **Step 1: Start dev mode**

Run: `npm run dev`

- [ ] **Step 2: Test claude terminal spawn**

1. Open a project in Mekan Terminal
2. Click "+ Terminal" dropdown
3. Click "Claude Code"
4. Verify the ClaudePane renders with the welcome message
5. Type "What is 2+2?" and press Enter
6. Verify the streaming response appears
7. Verify tool use blocks appear when Claude uses tools (try "Read package.json")

- [ ] **Step 3: Test cancel**

1. Send a long prompt like "Explain the entire codebase"
2. Click the stop button while streaming
3. Verify the partial response is preserved

- [ ] **Step 4: Test multiple claude panes**

1. Open a second Claude Code terminal
2. Verify both work independently

- [ ] **Step 5: Test close and reopen**

1. Close a claude terminal pane
2. Verify it's removed cleanly

- [ ] **Step 6: Final build verification**

Run: `npm run build && npm run package`
Expected: Build and packaging succeed.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```
