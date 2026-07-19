import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { useTerminalsStore } from './terminals';

const TYPING_SUPPRESS_MS = 1000;
const WAITING_DELAY_MS = 2000;
const DATA_WINDOW_MS = 500;
const DATA_THRESHOLD = 200;
const CURSOR_COLOR = '#6366f1';

const XTERM_OPTIONS = {
  theme: {
    background: '#09090b',
    foreground: '#d4d4d8',
    cursor: CURSOR_COLOR,
    cursorAccent: '#09090b',
    selectionBackground: '#6366f130',
    selectionForeground: '#ffffff',
    black: '#18181b',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#e4e4e7',
    brightBlack: '#3f3f46',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde68a',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#fafafa',
  },
  fontFamily: "'Cascadia Mono', 'Cascadia Code', 'Consolas', monospace",
  fontSize: 14,
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'bar' as const,
  cursorWidth: 2,
  scrollback: 5000,
  allowTransparency: true,
};

interface CachedTerminal {
  term: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  cleanup: () => void;
}

const cache = new Map<string, CachedTerminal>();
const busyState = new Map<string, {
  lastUserInputTime: number;
  busyTimer: ReturnType<typeof setTimeout> | null;
  waitingTimer: ReturnType<typeof setTimeout> | null;
  dataAccumResetTimer: ReturnType<typeof setTimeout> | null;
  isBusy: boolean;
  dataAccum: number;
}>();

export function getOrCreateTerminal(terminalId: string, projectId: string): CachedTerminal {
  const existing = cache.get(terminalId);
  if (existing) return existing;

  const term = new Terminal(XTERM_OPTIONS);
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon((_event, uri) => {
    window.mekan.shell.openExternal(uri);
  }));
  term.loadAddon(searchAddon);

  const store = useTerminalsStore.getState;

  const state = {
    lastUserInputTime: 0,
    busyTimer: null as ReturnType<typeof setTimeout> | null,
    waitingTimer: null as ReturnType<typeof setTimeout> | null,
    dataAccumResetTimer: null as ReturnType<typeof setTimeout> | null,
    isBusy: false,
    dataAccum: 0,
  };
  busyState.set(terminalId, state);

  function clearBusy() {
    if (!state.isBusy) return;
    state.isBusy = false;
    term.options.theme = { ...term.options.theme, cursor: CURSOR_COLOR, cursorAccent: '#09090b' };
    store().setBusy(projectId, terminalId, false);
  }

  term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && e.key === 'v') {
      if (e.type === 'keydown') {
        e.preventDefault();
        window.mekan.terminal.pasteImage(terminalId).then((result) => {
          if (result?.text) term.paste(result.text);
        }).catch(() => navigator.clipboard.readText().then((t) => { if (t) term.paste(t); }));
      }
      return false;
    }
    if (e.type !== 'keydown') return true;
    if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
      navigator.clipboard.writeText(term.getSelection());
      term.clearSelection();
      return false;
    }
    if (e.ctrlKey && e.key === 'Enter') {
      window.mekan.terminal.write(terminalId, '\n');
      return false;
    }
    return true;
  });

  term.onData((data) => {
    state.lastUserInputTime = Date.now();
    window.mekan.terminal.write(terminalId, data);
    clearBusy();
    if (state.waitingTimer) clearTimeout(state.waitingTimer);
    store().setWaiting(projectId, terminalId, false);
  });

  const removeDataListener = window.mekan.terminal.onData(terminalId, (data) => {
    term.write(data);

    const isUserTyping = (Date.now() - state.lastUserInputTime) < TYPING_SUPPRESS_MS;
    if (isUserTyping) return;

    state.dataAccum += data.length;
    if (!state.dataAccumResetTimer) {
      state.dataAccumResetTimer = setTimeout(() => {
        state.dataAccum = 0;
        state.dataAccumResetTimer = null;
      }, DATA_WINDOW_MS);
    }

    if (state.dataAccum >= DATA_THRESHOLD) {
      if (!state.isBusy) {
        state.isBusy = true;
        term.options.theme = { ...term.options.theme, cursor: 'transparent', cursorAccent: 'transparent' };
        store().setBusy(projectId, terminalId, true);
      }
      if (state.waitingTimer) clearTimeout(state.waitingTimer);
      store().setWaiting(projectId, terminalId, false);
      if (state.busyTimer) clearTimeout(state.busyTimer);
      state.busyTimer = setTimeout(() => {
        clearBusy();
        state.waitingTimer = setTimeout(() => {
          store().setWaiting(projectId, terminalId, true);
        }, WAITING_DELAY_MS);
      }, 800);
    }
  });

  const removeStatusListener = window.mekan.terminal.onStatus(terminalId, (status, exitCode) => {
    store().updateStatus(projectId, terminalId, status, exitCode);
    if (status === 'exited') {
      clearBusy();
      if (state.waitingTimer) clearTimeout(state.waitingTimer);
      store().setWaiting(projectId, terminalId, false);
    }
  });

  function cleanup() {
    if (state.busyTimer) clearTimeout(state.busyTimer);
    if (state.waitingTimer) clearTimeout(state.waitingTimer);
    if (state.dataAccumResetTimer) clearTimeout(state.dataAccumResetTimer);
    removeDataListener();
    removeStatusListener();
    term.dispose();
    cache.delete(terminalId);
    busyState.delete(terminalId);
  }

  const entry: CachedTerminal = { term, fitAddon, searchAddon, cleanup };
  cache.set(terminalId, entry);
  return entry;
}

export function destroyTerminal(terminalId: string) {
  const entry = cache.get(terminalId);
  if (entry) entry.cleanup();
}

export function markUserInput(terminalId: string) {
  const state = busyState.get(terminalId);
  if (state) state.lastUserInputTime = Date.now();
}
