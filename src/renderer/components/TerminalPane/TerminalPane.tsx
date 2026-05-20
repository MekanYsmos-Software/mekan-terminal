import { useEffect, useRef, useState } from 'react';
import { useTerminal } from './useTerminal';
import { useTerminalsStore } from '../../stores/terminals';
import { useGitStore } from '../../stores/git';
import { pasteToTerminal } from '../../stores/terminal-monitor';
import ClaudePane from '../ClaudePane/ClaudePane';

interface Props {
  terminalId: string;
  projectId: string;
  cwd: string;
  hideHeader?: boolean;
  index?: number;
  totalCount?: number;
}

export default function TerminalPane({ terminalId, projectId, cwd, hideHeader, index, totalCount }: Props) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const removeTerminal = useTerminalsStore((s) => s.removeTerminal);
  const restartTerminal = useTerminalsStore((s) => s.restartTerminal);
  const renameTerminal = useTerminalsStore((s) => s.renameTerminal);
  const reorderTerminals = useTerminalsStore((s) => s.reorderTerminals);
  const terminal = useTerminalsStore((s) => (s.terminals[projectId] ?? []).find((t) => t.id === terminalId));
  const [editName, setEditName] = useState(terminal?.name ?? '');
  const status = terminal?.status ?? 'running';
  const busy = terminal?.busy ?? false;
  const waiting = terminal?.waiting ?? false;

  const worktrees = useGitStore((s) => s.worktrees);
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);

  const normalizedCwd = cwd.replace(/\\/g, '/').toLowerCase();
  const matchedWorktree = worktrees.find((wt) => normalizedCwd.startsWith(wt.path.replace(/\\/g, '/').toLowerCase()));
  const isNonMainWorktree = matchedWorktree && !matchedWorktree.isMain;
  const showWorktreeInfo = worktrees.length > 1 && isNonMainWorktree;
  const currentBranch = branches.find((b) => b.current);
  const terminalBranch = matchedWorktree
    ? matchedWorktree.branch
    : currentBranch?.name ?? null;

  const { containerRef, searchNext, searchPrev, searchClear } = useTerminal({ terminalId, projectId });
  const [dropHighlight, setDropHighlight] = useState(false);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;

    function onDragEnter(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setDropHighlight(true);
    }

    function onDragOver(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setDropHighlight(true);
    }

    function onDragLeave(e: DragEvent) {
      if (el.contains(e.relatedTarget as Node)) return;
      setDropHighlight(false);
    }

    function onDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      setDropHighlight(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const paths = Array.from(files).map((f) => {
          const p = window.mekan.utils.getPathForFile(f);
          if (!p) return '';
          return p.includes(' ') ? `"${p}"` : p;
        }).filter(Boolean);
        if (paths.length > 0) {
          window.mekan.terminal.write(terminalId, paths.join(' '));
        }
        return;
      }

      const uri = e.dataTransfer?.getData('text/uri-list');
      if (uri) {
        window.mekan.terminal.write(terminalId, uri.split('\n').filter(Boolean).join(' '));
        return;
      }

      const text = e.dataTransfer?.getData('text/plain');
      if (text) {
        pasteToTerminal(terminalId, projectId, text);
      }
    }

    el.addEventListener('dragenter', onDragEnter, true);
    el.addEventListener('dragover', onDragOver, true);
    el.addEventListener('dragleave', onDragLeave, true);
    el.addEventListener('drop', onDrop, true);
    return () => {
      el.removeEventListener('dragenter', onDragEnter, true);
      el.removeEventListener('dragover', onDragOver, true);
      el.removeEventListener('dragleave', onDragLeave, true);
      el.removeEventListener('drop', onDrop, true);
    };
  }, [terminalId, projectId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setSearching(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    }
    const el = paneRef.current;
    if (el) el.addEventListener('keydown', handleKeyDown);
    return () => { if (el) el.removeEventListener('keydown', handleKeyDown); };
  }, []);

  function closeSearch() {
    setSearching(false);
    setSearchQuery('');
    searchClear();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) searchPrev(searchQuery);
      else searchNext(searchQuery);
    }
    if (e.key === 'Escape') closeSearch();
  }

  function sendCommand(cmd: string) {
    if (status === 'running') {
      window.mekan.terminal.write(terminalId, cmd + '\r');
    }
  }

  function handleClose() {
    removeTerminal(projectId, terminalId);
  }

  async function handleRestart() {
    await restartTerminal(projectId, terminalId);
  }

  function startRename() {
    setEditName(terminal?.name ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== terminal?.name) {
      renameTerminal(projectId, terminalId, trimmed);
    }
    setEditing(false);
  }

  return (
    <div ref={paneRef} className="flex flex-col h-full w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Terminal header */}
      {!hideHeader && <div className="flex items-center h-8 px-3 bg-surface-1 border-b border-border gap-2 flex-shrink-0">
        {/* Status indicator */}
        {busy ? (
          <div className="w-3 h-3 rounded-full border-[1.5px] border-accent/40 border-t-accent animate-spin flex-shrink-0" />
        ) : waiting && status === 'running' ? (
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400 animate-pulse shadow-[0_0_4px_rgba(251,191,36,0.4)]" title="Waiting for input" />
        ) : (
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
            status === 'running' ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]' : 'bg-zinc-600'
          }`} />
        )}

        {editing ? (
          <input
            ref={inputRef}
            className="text-xxs bg-surface-3 text-white px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent flex-1 min-w-0 transition-all"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="text-xxs text-zinc-500 font-medium truncate cursor-pointer hover:text-zinc-300 transition-colors"
            onClick={(e) => { e.stopPropagation(); startRename(); }}
            title="Click to rename"
          >
            {terminal?.name ?? 'Terminal'}
          </span>
        )}
        {terminalBranch && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" className="text-zinc-700">
              <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="text-xxs text-accent/70 font-medium">{terminalBranch}</span>
            {!isNonMainWorktree && isDirty && <span className="w-1 h-1 rounded-full bg-amber-500" />}
          </span>
        )}
        {showWorktreeInfo && (
          <span className="text-xxs text-zinc-700 bg-surface-3 px-1.5 py-0.5 rounded font-mono flex-shrink-0" title={cwd}>WT</span>
        )}
        <div className="flex-1 min-w-0" />
        {hovered && !editing && status === 'running' && terminal?.shell !== 'claude' && (
          <div className="flex items-center gap-1 animate-fade-in mr-1">
            {[
              { label: 'clear', cmd: '/clear', title: '/clear (Claude Code)' },
              { label: 'compact', cmd: '/compact', title: '/compact (Claude Code)' },
              { label: 'claude', cmd: 'claude' },
              { label: 'claude !', cmd: 'claude --dangerously-skip-permissions', title: 'Claude (skip permissions)' },
            ].map((shortcut) => (
              <button
                key={shortcut.label}
                onClick={() => sendCommand(shortcut.cmd)}
                className="text-xxs px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500 hover:text-white hover:bg-accent/20 transition-all font-medium"
                title={shortcut.title ?? shortcut.cmd}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        )}
        {hovered && !editing && (
          <div className="flex items-center gap-0.5 animate-fade-in">
            {totalCount != null && totalCount > 1 && index != null && (
              <>
                {index > 0 && (
                  <button
                    onClick={() => reorderTerminals(projectId, index, index - 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all"
                    title="Move left"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M5 1L2 4L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                )}
                {index < totalCount - 1 && (
                  <button
                    onClick={() => reorderTerminals(projectId, index, index + 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all"
                    title="Move right"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M3 1L6 4L3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                )}
              </>
            )}
            {status === 'exited' && (
              <button onClick={handleRestart} className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all" title="Restart">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0110.89-3.48M14 8a6 6 0 01-10.89 3.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            <button onClick={handleClose} className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
      </div>}

      {/* Search bar */}
      {searching && (
        <div className="flex items-center h-8 px-3 bg-surface-2 border-b border-border gap-2 flex-shrink-0 animate-fade-in">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-zinc-600 flex-shrink-0">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchInputRef}
            className="text-xxs bg-surface-3 text-white px-2 py-1 rounded-md outline-none border border-border focus:border-accent/50 flex-1 min-w-0 transition-all"
            placeholder="Search in terminal..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) searchNext(e.target.value);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          <button onClick={() => searchPrev(searchQuery)} className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all" title="Previous (Shift+Enter)">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 5L4 2L7 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => searchNext(searchQuery)} className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all" title="Next (Enter)">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={closeSearch} className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-surface-3 transition-all" title="Close (Esc)">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {terminal?.shell === 'claude' ? (
        <ClaudePane terminalId={terminalId} projectId={projectId} cwd={cwd} />
      ) : (
        <div
          ref={containerRef}
          className={`flex-1 min-h-0 overflow-hidden transition-shadow duration-150 ${dropHighlight ? 'ring-1 ring-inset ring-accent/50' : ''}`}
        />
      )}
    </div>
  );
}
