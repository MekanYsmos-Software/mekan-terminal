import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';

interface UseTerminalOptions {
  terminalId: string;
  onStatusChange?: (status: 'running' | 'exited', exitCode: number | null) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function useTerminal({ terminalId, onStatusChange, onBusyChange }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);

  const fit = useCallback(() => {
    if (fitRef.current) {
      try {
        fitRef.current.fit();
        if (termRef.current) {
          window.mekan.terminal.resize(terminalId, termRef.current.cols, termRef.current.rows);
        }
      } catch {
        // container not visible yet
      }
    }
  }, [terminalId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#d4d4d8',
        cursor: '#6366f1',
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
      fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 5000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon((_event, uri) => {
      window.mekan.shell.openExternal(uri);
    }));
    term.loadAddon(searchAddon);

    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fitAddon;
    searchRef.current = searchAddon;

    requestAnimationFrame(() => fitAddon.fit());

    term.attachCustomKeyEventHandler((e) => {
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
      if (e.ctrlKey && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.mekan.terminal.write(terminalId, text);
        });
        return false;
      }
      return true;
    });

    term.onData((data) => {
      window.mekan.terminal.write(terminalId, data);
    });

    let busyTimer: ReturnType<typeof setTimeout> | null = null;
    let isBusy = false;
    const removeDataListener = window.mekan.terminal.onData(terminalId, (data) => {
      term.write(data);
      if (!isBusy) {
        isBusy = true;
        onBusyChange?.(true);
      }
      if (busyTimer) clearTimeout(busyTimer);
      busyTimer = setTimeout(() => {
        isBusy = false;
        onBusyChange?.(false);
      }, 800);
    });

    const removeStatusListener = window.mekan.terminal.onStatus(terminalId, (status, exitCode) => {
      onStatusChange?.(status, exitCode);
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
            window.mekan.terminal.resize(terminalId, term.cols, term.rows);
          } catch {
            // not visible
          }
        });
      }, 100);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      if (busyTimer) clearTimeout(busyTimer);
      resizeObserver.disconnect();
      removeDataListener();
      removeStatusListener();
      term.dispose();
    };
  }, [terminalId, onStatusChange, onBusyChange]);

  const searchNext = useCallback((query: string) => {
    searchRef.current?.findNext(query);
  }, []);

  const searchPrev = useCallback((query: string) => {
    searchRef.current?.findPrevious(query);
  }, []);

  const searchClear = useCallback(() => {
    searchRef.current?.clearDecorations();
  }, []);

  return { containerRef, fit, searchNext, searchPrev, searchClear };
}
