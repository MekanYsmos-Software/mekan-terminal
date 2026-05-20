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

  proc.stderr?.on('data', () => {});

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
