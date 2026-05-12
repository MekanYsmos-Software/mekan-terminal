import { create } from 'zustand';
import type { TerminalInstance, LayoutNode, LeafNode, SplitNode, SplitDirection, ShellType } from '@shared/types';

interface TerminalsState {
  terminals: Record<string, TerminalInstance[]>;
  layouts: Record<string, LayoutNode | null>;
  availableShells: ShellType[];

  loadShells(): Promise<void>;
  spawnTerminal(projectId: string, cwd: string, shellType?: ShellType): Promise<string>;
  killTerminal(projectId: string, terminalId: string): void;
  restartTerminal(terminalId: string): Promise<string | null>;
  updateStatus(projectId: string, terminalId: string, status: TerminalInstance['status'], exitCode: number | null): void;
  addTerminalToGrid(projectId: string, cwd: string, shellType?: ShellType): Promise<void>;
  splitPane(projectId: string, terminalId: string, direction: SplitDirection, cwd: string, shellType?: ShellType): Promise<void>;
  closePane(projectId: string, terminalId: string): void;
  loadLayout(projectId: string): Promise<void>;
  saveLayout(projectId: string): Promise<void>;
  getTerminalCount(projectId: string): number;
}

function countLeaves(node: LayoutNode | null): number {
  if (!node) return 0;
  if (node.type === 'leaf') return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function removeLeaf(node: LayoutNode | null, terminalId: string): LayoutNode | null {
  if (!node) return null;
  if (node.type === 'leaf') {
    return node.terminalId === terminalId ? null : node;
  }
  const children = node.children.map((child) => removeLeaf(child, terminalId)).filter(Boolean) as LayoutNode[];
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...node, children, sizes: children.map(() => 100 / children.length) };
}

function insertSplit(
  node: LayoutNode | null,
  targetId: string,
  direction: SplitDirection,
  newLeaf: LeafNode
): LayoutNode | null {
  if (!node) return newLeaf;
  if (node.type === 'leaf') {
    if (node.terminalId === targetId) {
      return { type: 'split', direction, sizes: [50, 50], children: [node, newLeaf] } as SplitNode;
    }
    return node;
  }
  return {
    ...node,
    children: node.children.map((child) => insertSplit(child, targetId, direction, newLeaf)).filter(Boolean) as LayoutNode[],
  };
}

function findFirstLeaf(node: LayoutNode | null): string | null {
  if (!node) return null;
  if (node.type === 'leaf') return node.terminalId;
  for (const child of node.children) {
    const found = findFirstLeaf(child);
    if (found) return found;
  }
  return null;
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  terminals: {},
  layouts: {},
  availableShells: [],

  async loadShells() {
    const shells = await window.mekan.terminal.getAvailableShells();
    set({ availableShells: shells });
  },

  async spawnTerminal(projectId, cwd, shellType?) {
    const id = await window.mekan.terminal.spawn(projectId, cwd, shellType);
    const instance: TerminalInstance = { id, projectId, status: 'running', exitCode: null, cwd, shell: shellType || get().availableShells[0] || 'cmd' };
    set((s) => {
      const projectTerminals = [...(s.terminals[projectId] || []), instance];
      const currentLayout = s.layouts[projectId];
      const newLeaf: LeafNode = { type: 'leaf', terminalId: id };
      return {
        terminals: { ...s.terminals, [projectId]: projectTerminals },
        layouts: { ...s.layouts, [projectId]: currentLayout ? currentLayout : newLeaf },
      };
    });
    return id;
  },

  killTerminal(projectId, terminalId) {
    window.mekan.terminal.kill(terminalId);
    set((s) => ({
      terminals: {
        ...s.terminals,
        [projectId]: (s.terminals[projectId] || []).filter((t) => t.id !== terminalId),
      },
    }));
  },

  async restartTerminal(terminalId) {
    const newId = await window.mekan.terminal.restart(terminalId);
    return newId ?? null;
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

  async addTerminalToGrid(projectId, cwd, shellType?) {
    if (get().getTerminalCount(projectId) >= 6) return;
    const layout = get().layouts[projectId];
    const firstLeaf = findFirstLeaf(layout);
    if (firstLeaf) {
      await get().splitPane(projectId, firstLeaf, 'horizontal', cwd, shellType);
    } else {
      await get().spawnTerminal(projectId, cwd, shellType);
    }
  },

  async splitPane(projectId, terminalId, direction, cwd, shellType?) {
    if (get().getTerminalCount(projectId) >= 6) return;
    const newId = await window.mekan.terminal.spawn(projectId, cwd, shellType);
    const shell = shellType || get().availableShells[0] || 'cmd';
    const instance: TerminalInstance = { id: newId, projectId, status: 'running', exitCode: null, cwd, shell };
    const newLeaf: LeafNode = { type: 'leaf', terminalId: newId };
    set((s) => {
      const projectTerminals = [...(s.terminals[projectId] || []), instance];
      const layout = insertSplit(s.layouts[projectId], terminalId, direction, newLeaf);
      return {
        terminals: { ...s.terminals, [projectId]: projectTerminals },
        layouts: { ...s.layouts, [projectId]: layout },
      };
    });
  },

  closePane(projectId, terminalId) {
    window.mekan.terminal.kill(terminalId);
    set((s) => {
      const layout = removeLeaf(s.layouts[projectId], terminalId);
      return {
        terminals: {
          ...s.terminals,
          [projectId]: (s.terminals[projectId] || []).filter((t) => t.id !== terminalId),
        },
        layouts: { ...s.layouts, [projectId]: layout },
      };
    });
  },

  async loadLayout(projectId) {
    const layout = await window.mekan.layout.load(projectId);
    if (layout) {
      set((s) => ({ layouts: { ...s.layouts, [projectId]: layout.root } }));
    }
  },

  async saveLayout(projectId) {
    const layout = get().layouts[projectId];
    await window.mekan.layout.save({ projectId, root: layout ?? null });
  },

  getTerminalCount(projectId) {
    return countLeaves(get().layouts[projectId]);
  },
}));
