import { create } from 'zustand';
import type { TerminalInstance, ShellType, TerminalConfig } from '@shared/types';
import { useProjectsStore } from './projects';

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
  savedCounts: Record<string, number>;
  availableShells: ShellType[];
  notifiedProjectIds: Set<string>;

  loadShells(): Promise<void>;
  loadSavedCounts(projectIds: string[]): Promise<void>;
  spawnTerminal(projectId: string, cwd: string, shellType?: ShellType, isServer?: boolean, serverName?: string): Promise<string>;
  restoreTerminals(projectId: string): Promise<void>;
  removeTerminal(projectId: string, terminalId: string): void;
  restartTerminal(projectId: string, terminalId: string): Promise<void>;
  renameTerminal(projectId: string, terminalId: string, name: string): void;
  reorderTerminals(projectId: string, fromIndex: number, toIndex: number): void;
  updateStatus(projectId: string, terminalId: string, status: TerminalInstance['status'], exitCode: number | null): void;
  setBusy(projectId: string, terminalId: string, busy: boolean): void;
  clearNotification(projectId: string): void;
  getTerminals(projectId: string): TerminalInstance[];
  getServerTerminal(projectId: string): TerminalInstance | undefined;
  getServerTerminals(projectId: string): TerminalInstance[];
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  terminals: {},
  savedCounts: {},
  availableShells: [],
  notifiedProjectIds: new Set(),

  async loadShells() {
    const shells = await window.mekan.terminal.getAvailableShells();
    set({ availableShells: shells });
  },

  async loadSavedCounts(projectIds) {
    const counts: Record<string, number> = {};
    await Promise.all(
      projectIds.map(async (id) => {
        const layout = await window.mekan.layout.load(id);
        if (layout?.terminals) {
          const nonServer = layout.terminals.filter((t: { isServer?: boolean }) => !t.isServer);
          counts[id] = nonServer.length;
        }
      })
    );
    set({ savedCounts: counts });
  },

  async spawnTerminal(projectId, cwd, shellType?, isServer = false, serverName?) {
    const current = get().terminals[projectId] || EMPTY;
    if (!isServer && current.filter((t) => !t.isServer).length >= 6) return '';
    if (isServer && current.some((t) => t.isServer && t.cwd === cwd)) return '';
    const shell = shellType || get().availableShells[0] || 'cmd';
    const id = await window.mekan.terminal.spawn(projectId, cwd, shell);
    const shellLabel = shell === 'pwsh' ? 'PS' : shell === 'wsl' ? 'WSL' : 'CMD';
    let name: string;
    if (isServer && serverName) {
      name = serverName;
    } else if (isServer) {
      const serverCount = current.filter((t) => t.isServer).length;
      name = `Server ${serverCount + 1}`;
    } else {
      const nonServerCount = current.filter((t) => !t.isServer).length;
      name = `${shellLabel} ${nonServerCount + 1}`;
    }
    const instance: TerminalInstance = {
      id,
      projectId,
      status: 'running',
      exitCode: null,
      cwd,
      shell,
      isServer,
      name,
      busy: false,
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

  reorderTerminals(projectId, fromIndex, toIndex) {
    const all = [...(get().terminals[projectId] || [])];
    const nonServer = all.filter((t) => !t.isServer);
    const servers = all.filter((t) => t.isServer);
    const [moved] = nonServer.splice(fromIndex, 1);
    nonServer.splice(toIndex, 0, moved);
    const updated = [...servers, ...nonServer];
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

  setBusy(projectId, terminalId, busy) {
    const terminals = get().terminals[projectId] || [];
    const terminal = terminals.find((t) => t.id === terminalId);
    if (!terminal || terminal.busy === busy) return;
    set((s) => ({
      terminals: {
        ...s.terminals,
        [projectId]: (s.terminals[projectId] || []).map((t) =>
          t.id === terminalId ? { ...t, busy } : t
        ),
      },
    }));
    if (!busy && terminal.busy && !terminal.isServer) {
      const isActiveProject = useProjectsStore.getState().activeProjectId === projectId;
      if (!isActiveProject) {
        window.mekan.window.flashIfBlurred();
        set((s) => ({ notifiedProjectIds: new Set(s.notifiedProjectIds).add(projectId) }));
      }
    }
  },

  clearNotification(projectId) {
    set((s) => {
      if (!s.notifiedProjectIds.has(projectId)) return s;
      const next = new Set(s.notifiedProjectIds);
      next.delete(projectId);
      return { notifiedProjectIds: next };
    });
  },

  getTerminals(projectId) {
    return get().terminals[projectId] || EMPTY;
  },

  getServerTerminal(projectId) {
    return (get().terminals[projectId] || EMPTY).find((t) => t.isServer);
  },

  getServerTerminals(projectId) {
    return (get().terminals[projectId] || EMPTY).filter((t) => t.isServer);
  },
}));
