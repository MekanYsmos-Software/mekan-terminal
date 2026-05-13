import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGitStore } from '../../stores/git';
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import SectionHeader from './SectionHeader';
import type { Project } from '@shared/types';

interface Props {
  project: Project;
}

export default function WorktreeSection({ project }: Props) {
  const projectPath = project.path;
  const worktrees = useGitStore((s) => s.worktrees);
  const addWorktree = useGitStore((s) => s.addWorktree);
  const removeWorktree = useGitStore((s) => s.removeWorktree);
  const collapsed = useGitStore((s) => s.collapsed['worktrees']);
  const setWorktreeBase = useProjectsStore((s) => s.setWorktreeBase);
  const [showCreate, setShowCreate] = useState(false);
  const [branch, setBranch] = useState('');
  const [folderName, setFolderName] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [basePath, setBasePath] = useState(project.worktreeBasePath || '');
  const [confirmRemove, setConfirmRemove] = useState<{ path: string; branch: string } | null>(null);
  const allTerminals = useTerminalsStore((s) => s.terminals);
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);
  const removeTerminal = useTerminalsStore((s) => s.removeTerminal);
  const projectTerminals = allTerminals[project.id] ?? [];
  const serverTerminals = projectTerminals.filter((t) => t.isServer);

  const defaultBase = `${projectPath}\\..\\worktrees`;
  const effectiveBase = project.worktreeBasePath || defaultBase;

  useEffect(() => {
    setBasePath(project.worktreeBasePath || '');
  }, [project.id]);

  async function handleCreate() {
    if (!branch.trim()) return;
    const folder = folderName.trim() || branch.trim();
    const wtPath = `${effectiveBase}\\${folder}`;
    await addWorktree(projectPath, wtPath, branch.trim(), createNew);
    setBranch('');
    setFolderName('');
    setCreateNew(false);
    setShowCreate(false);
  }

  function handleSaveBasePath() {
    setWorktreeBase(project.id, basePath.trim());
    setShowSettings(false);
  }

  function getServerForWorktree(wtPath: string) {
    const normalized = wtPath.replace(/\\/g, '/').toLowerCase();
    return serverTerminals.find((t) => t.cwd.replace(/\\/g, '/').toLowerCase() === normalized);
  }

  async function handleStartServer(wtPath: string, branch?: string) {
    if (!project.serverCommand) return;
    const id = await spawnTerminal(project.id, wtPath, undefined, true, branch);
    if (id) {
      setTimeout(() => {
        window.mekan.terminal.write(id, project.serverCommand + '\r');
      }, 500);
    }
  }

  function handleStopServer(wtPath: string) {
    const server = getServerForWorktree(wtPath);
    if (server) removeTerminal(project.id, server.id);
  }

  const icon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4M6 1h4v3H6V1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const actionBtns = (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => { setShowSettings(!showSettings); setShowCreate(false); }}
        className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all"
        title="Worktree settings"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M6.5 1.5h3l.5 2 1.5.9 2-.5 1.5 2.6-1.5 1.5v1.8l1.5 1.5-1.5 2.6-2-.5-1.5.9-.5 2h-3l-.5-2-1.5-.9-2 .5L1 11.5l1.5-1.5V8.2L1 6.7l1.5-2.6 2 .5 1.5-.9.5-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="8" cy="8.9" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>
      </button>
      <button
        onClick={() => { setShowCreate(!showCreate); setShowSettings(false); }}
        className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all"
        title="Create worktree"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  );

  return (
    <div>
      <SectionHeader section="worktrees" icon={icon} label="Worktrees" count={worktrees.length} action={actionBtns} />
      {!collapsed && (
        <>
          {showSettings && (
            <div className="p-3 border-b border-border space-y-2.5 animate-fade-in">
              <div className="text-xxs text-zinc-500 font-medium">Base directory</div>
              <input
                className="w-full bg-surface-3 text-white text-xs px-2.5 py-1.5 rounded-md outline-none border border-border focus:border-accent/50 focus:shadow-glow-sm transition-all font-mono"
                placeholder={defaultBase}
                value={basePath}
                onChange={(e) => setBasePath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBasePath()}
              />
              <div className="text-xxs text-zinc-700 truncate" title={effectiveBase}>
                {project.worktreeBasePath ? '' : 'Default: '}{effectiveBase}
              </div>
              <button
                onClick={handleSaveBasePath}
                className="w-full bg-accent hover:bg-accent-hover text-white text-xs py-1.5 rounded-md transition-all duration-200 font-medium hover:shadow-glow-sm"
              >
                Save
              </button>
            </div>
          )}
          {showCreate && (
            <div className="p-3 border-b border-border space-y-2.5 animate-fade-in">
              <input
                className="w-full bg-surface-3 text-white text-xs px-2.5 py-1.5 rounded-md outline-none border border-border focus:border-accent/50 focus:shadow-glow-sm transition-all"
                placeholder="Branch name"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <input
                className="w-full bg-surface-3 text-white text-xs px-2.5 py-1.5 rounded-md outline-none border border-border focus:border-accent/50 focus:shadow-glow-sm transition-all font-mono"
                placeholder={branch.trim() || 'Folder name (defaults to branch)'}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="text-xxs text-zinc-700 truncate" title={`${effectiveBase}\\${folderName.trim() || branch.trim() || '...'}`}>
                {effectiveBase}\{folderName.trim() || branch.trim() || '...'}
              </div>
              <label className="flex items-center gap-2 text-xxs text-zinc-500 cursor-pointer select-none">
                <input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} className="rounded accent-accent" />
                Create new branch
              </label>
              <button
                onClick={handleCreate}
                className="w-full bg-accent hover:bg-accent-hover text-white text-xs py-1.5 rounded-md transition-all duration-200 font-medium hover:shadow-glow-sm"
              >
                Create Worktree
              </button>
            </div>
          )}
          <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
            {worktrees.length === 0 && <div className="text-xxs text-zinc-700 px-2 py-2">No worktrees</div>}
            {worktrees.map((wt) => {
              const wtServer = getServerForWorktree(wt.path);
              const serverRunning = wtServer?.status === 'running';
              return (
                <div key={wt.path} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-zinc-500 hover:bg-surface-2 group transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-zinc-400 font-medium">{wt.branch || 'detached'}</div>
                    <div className="truncate text-xxs text-zinc-700">{wt.path}</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {project.serverCommand && (
                      serverRunning ? (
                        <button
                          onClick={() => handleStopServer(wt.path)}
                          className="w-5 h-5 flex items-center justify-center rounded text-green-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Stop server"
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><rect x="1" y="1" width="6" height="6" rx="0.5" fill="currentColor"/></svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartServer(wt.path, wt.branch)}
                          className="w-5 h-5 flex items-center justify-center rounded text-zinc-700 hover:text-green-400 hover:bg-green-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Start server"
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 0.5L7 4L1.5 7.5V0.5Z" fill="currentColor"/></svg>
                        </button>
                      )
                    )}
                    {!wt.isMain && (
                      <button
                        onClick={() => setConfirmRemove({ path: wt.path, branch: wt.branch || 'detached' })}
                        className="w-5 h-5 flex items-center justify-center rounded text-zinc-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove worktree"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {confirmRemove && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 glass animate-fade-in">
          <div className="bg-surface-2 border border-border-hover rounded-xl shadow-panel p-5 w-80 animate-slide-up">
            <div className="text-sm text-zinc-200 font-semibold mb-2">Remove Worktree</div>
            <div className="text-xs text-zinc-500 mb-2">
              Are you sure you want to remove this worktree?
            </div>
            <div className="text-xs text-zinc-300 bg-surface-3 rounded-lg px-3 py-2 mb-4 truncate font-mono border border-border">
              {confirmRemove.branch} — {confirmRemove.path}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-md bg-surface-3 hover:bg-surface-4 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeWorktree(projectPath, confirmRemove.path);
                  setConfirmRemove(null);
                }}
                className="text-xs text-white px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
