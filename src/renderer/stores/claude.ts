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
