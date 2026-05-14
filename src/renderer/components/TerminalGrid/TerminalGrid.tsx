import { useEffect, useState, useRef, useMemo } from 'react';
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import { useGitStore } from '../../stores/git';
import { useTasksStore } from '../../stores/tasks';
import TerminalPane from '../TerminalPane/TerminalPane';
import TasksPopup from '../TasksPopup/TasksPopup';
import FilesView from '../FilesView/FilesView';
import { useFilesStore } from '../../stores/files';
import type { ShellType, TerminalInstance } from '@shared/types';

const SHELL_LABELS: Record<ShellType, string> = {
  pwsh: 'PowerShell',
  cmd: 'CMD',
  wsl: 'WSL',
};

const EMPTY_TERMINALS: TerminalInstance[] = [];
const EMPTY_TASKS: import('@shared/types').ProjectTask[] = [];

function getGridStyle(count: number): React.CSSProperties {
  if (count <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
  if (count === 3) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' };
  if (count === 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
  if (count === 5) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
  return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
}

export default function TerminalGrid() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProjectName = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId)?.name ?? null);
  const activeProjectPath = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null);
  const allProjectTerminals = useTerminalsStore((s) => activeProjectId ? (s.terminals[activeProjectId] ?? EMPTY_TERMINALS) : EMPTY_TERMINALS);
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);
  const restoreTerminals = useTerminalsStore((s) => s.restoreTerminals);
  const availableShells = useTerminalsStore((s) => s.availableShells);
  const loadShells = useTerminalsStore((s) => s.loadShells);
  const worktrees = useGitStore((s) => s.worktrees);
  const terminals = useMemo(() => allProjectTerminals.filter((t) => !t.isServer), [allProjectTerminals]);

  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const tasksButtonRef = useRef<HTMLButtonElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const restoringRef = useRef<string | null>(null);
  const projectTasks = useTasksStore((s) => activeProjectId ? (s.tasks[activeProjectId] ?? EMPTY_TASKS) : EMPTY_TASKS);
  const loadTasks = useTasksStore((s) => s.loadTasks);
  const pendingCount = useMemo(() => projectTasks.filter((t) => t.status !== 'done').length, [projectTasks]);
  const filesView = useFilesStore((s) => s.view);
  const setFilesView = useFilesStore((s) => s.setView);

  useEffect(() => {
    loadShells();
  }, [loadShells]);

  useEffect(() => {
    if (!showNewMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewMenu]);

  useEffect(() => {
    if (activeProjectId) loadTasks(activeProjectId);
  }, [activeProjectId, loadTasks]);

  useEffect(() => {
    if (!activeProjectId || !activeProjectPath || restoringRef.current === activeProjectId) return;
    if (terminals.length > 0) return;
    restoringRef.current = activeProjectId;
    restoreTerminals(activeProjectId);
  }, [activeProjectId, activeProjectPath]);

  if (!activeProjectId || !activeProjectPath) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-700">
              <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="text-sm text-zinc-600">Select or add a project to get started</div>
        </div>
      </div>
    );
  }

  const canAdd = terminals.length < 6;

  function handleNewTerminal(shell: ShellType, cwd?: string) {
    setShowNewMenu(false);
    spawnTerminal(activeProjectId!, cwd || activeProjectPath!, shell);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex items-center h-9 px-3 bg-surface-1 border-b border-border gap-3 flex-shrink-0">
        {activeProjectName && (
          <span className="text-xxs text-zinc-500 font-medium">{activeProjectName}</span>
        )}
        <span className="text-xxs text-zinc-600 font-mono">{terminals.length}<span className="text-zinc-700">/6</span></span>
        {canAdd && (
          <div className="relative" ref={newMenuRef}>
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center gap-1.5 text-xxs text-zinc-500 hover:text-white px-2.5 py-1 rounded-md bg-surface-3 hover:bg-accent hover:shadow-glow-sm transition-all duration-200 font-medium"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Terminal
            </button>
            {showNewMenu && (
              <div className="absolute top-full left-0 mt-1.5 z-50 bg-surface-2 border border-border-hover rounded-lg shadow-panel py-1.5 min-w-[200px] animate-fade-in">
                {availableShells.map((shell) => (
                  <button
                    key={shell}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors"
                    onClick={() => handleNewTerminal(shell)}
                  >
                    {SHELL_LABELS[shell]}
                  </button>
                ))}
                {worktrees.length > 1 && (
                  <>
                    <div className="border-t border-border my-1.5 mx-2" />
                    <div className="px-3 py-1 text-xxs text-zinc-600 font-medium tracking-wider uppercase">Worktrees</div>
                    {worktrees.map((wt) => (
                      <div key={wt.path} className="px-3 py-1.5">
                        <div className="text-xxs text-zinc-400 mb-1 font-medium">{wt.branch || 'detached'}</div>
                        <div className="flex gap-1">
                          {availableShells.map((shell) => (
                            <button
                              key={shell}
                              className="text-xxs text-zinc-500 hover:text-white px-2 py-0.5 rounded-md bg-surface-3 hover:bg-accent transition-all duration-200"
                              onClick={() => handleNewTerminal(shell, wt.path)}
                            >
                              {SHELL_LABELS[shell]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <button
            ref={tasksButtonRef}
            onClick={() => setShowTasks(!showTasks)}
            className="flex items-center gap-1.5 text-xxs text-zinc-500 hover:text-white px-2.5 py-1 rounded-md bg-surface-3 hover:bg-surface-4 transition-all duration-200 font-medium"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 6h8M4 9h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Tasks
            {pendingCount > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-xxs px-1 rounded-sm font-mono">{pendingCount}</span>
            )}
          </button>
          {activeProjectId && (
            <TasksPopup
              projectId={activeProjectId}
              open={showTasks}
              onClose={() => setShowTasks(false)}
              anchorRef={tasksButtonRef}
            />
          )}
        </div>
        <button
          onClick={() => setFilesView(filesView === 'files' ? 'terminals' : 'files')}
          className={`flex items-center gap-1.5 text-xxs px-2.5 py-1 rounded-md transition-all duration-200 font-medium ${
            filesView === 'files'
              ? 'bg-accent/20 text-accent'
              : 'text-zinc-500 hover:text-white bg-surface-3 hover:bg-surface-4'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Files
        </button>
        <div className="flex-1" />
      </div>
      {filesView === 'files' ? (
        <FilesView projectPath={activeProjectPath!} />
      ) : terminals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-700">
                <path d="M4 17l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-sm text-zinc-600 mb-4">No terminals open</div>
            <div className="flex items-center justify-center gap-2">
              {availableShells.map((shell) => (
                <button
                  key={shell}
                  onClick={() => handleNewTerminal(shell)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-accent hover:shadow-glow-sm transition-all duration-200 font-medium border border-border hover:border-accent"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  {SHELL_LABELS[shell]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 min-w-0 grid gap-[1px] bg-border"
          style={getGridStyle(terminals.length)}
        >
          {terminals.map((t, i) => (
            <div key={t.id} className="bg-surface-0 min-h-0 min-w-0">
              <TerminalPane
                terminalId={t.id}
                projectId={activeProjectId}
                cwd={t.cwd}
                index={i}
                totalCount={terminals.length}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
