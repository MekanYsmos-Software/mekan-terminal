import { useEffect, useState } from 'react';
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import { useGitStore } from '../../stores/git';
import SplitNodeView from './SplitNode';
import type { ShellType } from '@shared/types';

const SHELL_LABELS: Record<ShellType, string> = {
  pwsh: 'PowerShell',
  cmd: 'CMD',
  wsl: 'WSL',
};

export default function TerminalGrid() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const layout = useTerminalsStore((s) => (activeProjectId ? s.layouts[activeProjectId] : null));
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);
  const addTerminalToGrid = useTerminalsStore((s) => s.addTerminalToGrid);
  const availableShells = useTerminalsStore((s) => s.availableShells);
  const loadShells = useTerminalsStore((s) => s.loadShells);
  const getTerminalCount = useTerminalsStore((s) => s.getTerminalCount);
  const worktrees = useGitStore((s) => s.worktrees);

  const [showNewMenu, setShowNewMenu] = useState(false);

  useEffect(() => {
    loadShells();
  }, [loadShells]);

  useEffect(() => {
    if (activeProjectId && activeProject && !layout) {
      spawnTerminal(activeProjectId, activeProject.path);
    }
  }, [activeProjectId, activeProject, layout, spawnTerminal]);

  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Select or add a project to get started.
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Starting terminal...
      </div>
    );
  }

  const count = getTerminalCount(activeProjectId);
  const canAdd = count < 6;

  function handleNewTerminal(shell: ShellType, cwd?: string) {
    setShowNewMenu(false);
    addTerminalToGrid(activeProjectId!, cwd || activeProject!.path, shell);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex items-center h-8 px-2 bg-surface-1 border-b border-zinc-800 gap-1 flex-shrink-0">
        <span className="text-xxs text-zinc-500 mr-2">{count}/6</span>
        {canAdd && (
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-surface-3 hover:bg-accent transition-colors"
            >
              + Terminal
            </button>
            {showNewMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-surface-2 border border-zinc-700 rounded shadow-lg py-1 min-w-[180px]">
                {availableShells.map((shell) => (
                  <button
                    key={shell}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3"
                    onClick={() => handleNewTerminal(shell)}
                  >
                    {SHELL_LABELS[shell]} — {activeProject!.path.split('\\').pop()}
                  </button>
                ))}
                {worktrees.length > 1 && (
                  <>
                    <div className="border-t border-zinc-700 my-1" />
                    <div className="px-3 py-1 text-xxs text-zinc-600">Worktrees</div>
                    {worktrees.map((wt) => (
                      <div key={wt.path} className="px-3 py-1">
                        <div className="text-xxs text-zinc-400 mb-0.5">{wt.branch || 'detached'}</div>
                        <div className="flex gap-1">
                          {availableShells.map((shell) => (
                            <button
                              key={shell}
                              className="text-xxs text-zinc-500 hover:text-white px-1.5 py-0.5 rounded bg-surface-3 hover:bg-accent transition-colors"
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
        <div className="flex-1" />
      </div>
      <div className="flex-1 min-h-0 min-w-0">
        <SplitNodeView node={layout} projectId={activeProjectId} cwd={activeProject.path} />
      </div>
    </div>
  );
}
