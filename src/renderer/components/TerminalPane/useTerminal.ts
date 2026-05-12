import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface UseTerminalOptions {
  terminalId: string;
  onStatusChange?: (status: 'running' | 'exited', exitCode: number | null) => void;
}

export function useTerminal({ terminalId, onStatusChange }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

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
        background: '#0e0e10',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        selectionBackground: '#6366f140',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
      },
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fitAddon;

    requestAnimationFrame(() => fitAddon.fit());

    term.onData((data) => {
      window.mekan.terminal.write(terminalId, data);
    });

    const removeDataListener = window.mekan.terminal.onData(terminalId, (data) => {
      term.write(data);
    });

    const removeStatusListener = window.mekan.terminal.onStatus(terminalId, (status, exitCode) => {
      onStatusChange?.(status, exitCode);
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          window.mekan.terminal.resize(terminalId, term.cols, term.rows);
        } catch {
          // not visible
        }
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      removeDataListener();
      removeStatusListener();
      term.dispose();
    };
  }, [terminalId, onStatusChange]);

  return { containerRef, fit };
}
