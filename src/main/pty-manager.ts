import os from 'os';
import type { BrowserWindow } from 'electron';
import type { TerminalStatus } from '@shared/types';

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
