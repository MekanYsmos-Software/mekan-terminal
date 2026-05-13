import { create } from 'zustand';
import type { DirEntry } from '@shared/types';

export interface FileTab {
  filePath: string;
  name: string;
  dirty: boolean;
  content: string;
}

interface FilesState {
  view: 'terminals' | 'files';
  rootPath: string | null;
  openTabs: FileTab[];
  activeTabPath: string | null;
  expandedDirs: Set<string>;
  dirContents: Record<string, DirEntry[]>;

  setView(view: 'terminals' | 'files'): void;
  setRootPath(path: string): void;
  openFile(filePath: string, fileName: string): Promise<void>;
  closeTab(filePath: string): boolean;
  setActiveTab(filePath: string): void;
  setDirty(filePath: string, dirty: boolean): void;
  updateContent(filePath: string, content: string): void;
  saveFile(filePath: string): Promise<void>;
  toggleDir(dirPath: string): Promise<void>;
  loadDir(dirPath: string): Promise<void>;
  reset(): void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  view: 'terminals',
  rootPath: null,
  openTabs: [],
  activeTabPath: null,
  expandedDirs: new Set(),
  dirContents: {},

  setView(view) {
    set({ view });
  },

  setRootPath(rootPath) {
    set({ rootPath, expandedDirs: new Set(), dirContents: {} });
    get().loadDir(rootPath);
  },

  async openFile(filePath, fileName) {
    const existing = get().openTabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabPath: filePath });
      return;
    }
    const content = await window.mekan.fs.readFile(filePath);
    set((s) => ({
      openTabs: [...s.openTabs, { filePath, name: fileName, dirty: false, content }],
      activeTabPath: filePath,
    }));
  },

  closeTab(filePath) {
    const tab = get().openTabs.find((t) => t.filePath === filePath);
    if (tab?.dirty) {
      const confirmed = window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`);
      if (!confirmed) return false;
    }
    const tabs = get().openTabs.filter((t) => t.filePath !== filePath);
    const wasActive = get().activeTabPath === filePath;
    set({
      openTabs: tabs,
      activeTabPath: wasActive ? (tabs[tabs.length - 1]?.filePath ?? null) : get().activeTabPath,
    });
    return true;
  },

  setActiveTab(filePath) {
    set({ activeTabPath: filePath });
  },

  setDirty(filePath, dirty) {
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.filePath === filePath ? { ...t, dirty } : t
      ),
    }));
  },

  updateContent(filePath, content) {
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.filePath === filePath ? { ...t, content, dirty: true } : t
      ),
    }));
  },

  async saveFile(filePath) {
    const tab = get().openTabs.find((t) => t.filePath === filePath);
    if (!tab) return;
    await window.mekan.fs.writeFile(filePath, tab.content);
    get().setDirty(filePath, false);
  },

  async toggleDir(dirPath) {
    const expanded = new Set(get().expandedDirs);
    if (expanded.has(dirPath)) {
      expanded.delete(dirPath);
      set({ expandedDirs: expanded });
    } else {
      expanded.add(dirPath);
      set({ expandedDirs: expanded });
      if (!get().dirContents[dirPath]) {
        await get().loadDir(dirPath);
      }
    }
  },

  async loadDir(dirPath) {
    const entries = await window.mekan.fs.readdir(dirPath);
    set((s) => ({
      dirContents: { ...s.dirContents, [dirPath]: entries },
    }));
  },

  reset() {
    set({
      view: 'terminals',
      rootPath: null,
      openTabs: [],
      activeTabPath: null,
      expandedDirs: new Set(),
      dirContents: {},
    });
  },
}));
