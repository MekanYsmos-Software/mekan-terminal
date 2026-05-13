import { create } from 'zustand';
import type { TerminalInstance, ShellType, TerminalConfig } from '@shared/types';

const EMPTY: TerminalInstance[] = [];

function saveLayout(projectId: string, terminals: TerminalInstance[]) {
  const configs: TerminalConfig[] = terminals.map((t) => ({
    shell: t.shell,
    cwd: t.cwd,
    name: t.name,
    isServer: t.isServer,
  }));
  window.mekan.layout.save({ projectId, terminals: configs });
}

interface TerminalsState {
  terminals: Record<string, TerminalInstance[]>;
  availableShells: ShellType[];

  loadShells(): Promise<void>;
  spawnTerminal(projectId: string, cwd: string, shellType?: ShellType, isServer?: boolean): Promise<string>;
  restoreTerminals(projectId: string): Promise<void>;
  removeTerminal(projectId: string, terminalId: string): void;
  restartTerminal(projectId: string, terminalId: string): Promise<void>;
  renameTerminal(projectId: string, terminalId: string, name: string): void;
  updateStatus(projectId: string, terminalId: string, status: TerminalInstance['status'], exitCode: number | null): void;
  getTerminals(projectId: string): TerminalInstance[];
  getServerTerminal(projectId: string): TerminalInstance | undefined;
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  terminals: {},
  availableShells: [],

  async loadShells() {
    const shells = await window.mekan.terminal.getAvailableShells();
    set({ availableShells: shells });
  },

  async spawnTerminal(projectId, cwd, shellType?, isServer = false) {
    const current = get().terminals[projectId] || EMPTY;
    if (isServer && current.some((t) => t.isServer)) return '';
    if (!isServer && current.filter((t) => !t.isServer).length >= 6) return '';
    const shell = shellType || get().availableShells[0] || 'cmd';
    const id = await window.mekan.terminal.spawn(projectId, cwd, shell);
    const count = current.length + 1;
    const shellLabel = shell === 'pwsh' ? 'PS' : shell === 'wsl' ? 'WSL' : 'CMD';
    const instance: TerminalInstance = {
      id,
      projectId,
      status: 'running',
      exitCode: null,
      cwd,
      shell,
      isServer,
      name: isServer ? 'Server' : `${shellLabel} ${count}`,
    };
    const updated = [...(current), instance];
    set((s) => ({
      terminals: { ...s.terminals, [projectId]: updated },
    }));
    saveLayout(projectId, updated);
    return id;
  },

  async restoreTerminals(projectId) {
    const existing = get().terminals[projectId];
    if (existing && existing.length > 0) return;
    const layout = await window.mekan.layout.load(projectId);
    if (!layout || !layout.terminals || layout.terminals.length === 0) return;
    for (const cfg of layout.terminals) {
      if (cfg.isServer) continue;
      await get().spawnTerminal(projectId, cfg.cwd, cfg.shell);
      const terms = get().terminals[projectId] || [];
      const last = terms[terms.length - 1];
      if (last && cfg.name) {
        get().renameTerminal(projectId, last.id, cfg.name);
      }
    }
  },

  removeTerminal(projectId, terminalId) {
    window.mekan.terminal.kill(terminalId);
    const updated = (get().terminals[projectId] || []).filter((t) => t.id !== terminalId);
    set((s) => ({
      terminals: { ...s.terminals, [projectId]: updated },
    }));
    saveLayout(projectId, updated);
  },

  async restartTerminal(projectId, terminalId) {
    const old = (get().terminals[projectId] || []).find((t) => t.id === terminalId);
    if (!old) return;
    const newId = await window.mekan.terminal.restart(terminalId);
    if (!newId) return;
    set((s) => ({
      terminals: {
        ...s.terminals,
        [projectId]: (s.terminals[projectId] || []).map((t) =>
          t.id === terminalId ? { ...t, id: newId, status: 'running' as const, exitCode: null } : t
        ),
      },
    }));
  },

  renameTerminal(projectId, terminalId, name) {
    const updated = (get().terminals[projectId] || []).map((t) =>
      t.id === terminalId ? { ...t, name } : t
    );
    set((s) => ({
      terminals: { ...s.terminals, [projectId]: updated },
    }));
    saveLayout(projectId, updated);
  },

  updateStatus(projectId, terminalId, status, exitCode) {
    set((s) => ({
      terminals: {
        ...s.terminals,
        [projectId]: (s.terminals[projectId] || []).map((t) =>
          t.id === terminalId ? { ...t, status, exitCode } : t
        ),
      },
    }));
  },

  getTerminals(projectId) {
    return get().terminals[projectId] || EMPTY;
  },

  getServerTerminal(projectId) {
    return (get().terminals[projectId] || EMPTY).find((t) => t.isServer);
  },
}));
