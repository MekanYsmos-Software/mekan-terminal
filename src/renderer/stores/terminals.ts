import { create } from 'zustand';
import type { TerminalInstance, LayoutNode, LeafNode, SplitNode, SplitDirection } from '@shared/types';

interface TerminalsState {
  terminals: Record<string, TerminalInstance[]>;
  layouts: Record<string, LayoutNode | null>;

  spawnTerminal(projectId: string, cwd: string): Promise<string>;
  killTerminal(projectId: string, terminalId: string): void;
  restartTerminal(terminalId: string): Promise<string | null>;
  updateStatus(projectId: string, terminalId: string, status: TerminalInstance['status'], exitCode: number | null): void;
  splitPane(projectId: string, terminalId: string, direction: SplitDirection, cwd: string): Promise<void>;
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

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  terminals: {},
  layouts: {},

  async spawnTerminal(projectId, cwd) {
    const id = await window.mekan.terminal.spawn(projectId, cwd);
    const instance: TerminalInstance = { id, projectId, status: 'running', exitCode: null, cwd, shell: '' };
    set((s) => {
      const projectTerminals = [...(s.terminals[projectId] || []), instance];
      const currentLayout = s.layouts[projectId];
      const newLeaf: LeafNode = { type: 'leaf', terminalId: id };
      const newLayout = currentLayout ? currentLayout : newLeaf;
      return {
        terminals: { ...s.terminals, [projectId]: projectTerminals },
        layouts: { ...s.layouts, [projectId]: currentLayout ? currentLayout : newLayout },
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

  async splitPane(projectId, terminalId, direction, cwd) {
    if (get().getTerminalCount(projectId) >= 6) return;
    const newId = await window.mekan.terminal.spawn(projectId, cwd);
    const instance: TerminalInstance = { id: newId, projectId, status: 'running', exitCode: null, cwd, shell: '' };
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
