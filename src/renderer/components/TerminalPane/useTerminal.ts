import { useEffect, useRef, useCallback } from 'react';
import 'xterm/css/xterm.css';
import { getOrCreateTerminal } from '../../stores/terminal-monitor';

interface UseTerminalOptions {
  terminalId: string;
  projectId: string;
}

export function useTerminal({ terminalId, projectId }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef(false);

  const fit = useCallback(() => {
    const cached = getOrCreateTerminal(terminalId, projectId);
    try {
      cached.fitAddon.fit();
      window.mekan.terminal.resize(terminalId, cached.term.cols, cached.term.rows);
    } catch {
      // container not visible yet
    }
  }, [terminalId, projectId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const cached = getOrCreateTerminal(terminalId, projectId);
    const { term, fitAddon } = cached;

    if (term.element) {
      if (term.element.parentElement !== container) {
        container.replaceChildren();
        container.appendChild(term.element);
      }
    } else {
      container.replaceChildren();
      term.open(container);
    }
    attachedRef.current = true;

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        window.mekan.terminal.resize(terminalId, term.cols, term.rows);
        term.focus();
      } catch { /* not visible */ }
    });

    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          const prevCols = term.cols;
          const prevRows = term.rows;
          fitAddon.fit();
          if (term.cols !== prevCols || term.rows !== prevRows) {
            window.mekan.terminal.resize(terminalId, term.cols, term.rows);
          }
        } catch { /* not visible */ }
      });
    });
    resizeObserver.observe(container);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [terminalId, projectId]);

  const searchNext = useCallback((query: string) => {
    const cached = getOrCreateTerminal(terminalId, projectId);
    cached.searchAddon.findNext(query);
  }, [terminalId, projectId]);

  const searchPrev = useCallback((query: string) => {
    const cached = getOrCreateTerminal(terminalId, projectId);
    cached.searchAddon.findPrevious(query);
  }, [terminalId, projectId]);

  const searchClear = useCallback(() => {
    const cached = getOrCreateTerminal(terminalId, projectId);
    cached.searchAddon.clearDecorations();
  }, [terminalId, projectId]);

  return { containerRef, fit, searchNext, searchPrev, searchClear };
}
