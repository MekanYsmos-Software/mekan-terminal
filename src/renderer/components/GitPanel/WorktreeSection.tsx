import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGitStore } from '../../stores/git';
import SectionHeader from './SectionHeader';

interface Props {
  projectPath: string;
}

export default function WorktreeSection({ projectPath }: Props) {
  const worktrees = useGitStore((s) => s.worktrees);
  const addWorktree = useGitStore((s) => s.addWorktree);
  const removeWorktree = useGitStore((s) => s.removeWorktree);
  const collapsed = useGitStore((s) => s.collapsed['worktrees']);
  const [showCreate, setShowCreate] = useState(false);
  const [branch, setBranch] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ path: string; branch: string } | null>(null);

  async function handleCreate() {
    if (!branch.trim()) return;
    const wtPath = `${projectPath}/../.worktrees/${branch.trim()}`;
    await addWorktree(projectPath, wtPath, branch.trim(), createNew);
    setBranch('');
    setCreateNew(false);
    setShowCreate(false);
  }

  const icon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4M6 1h4v3H6V1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const addBtn = (
    <button
      onClick={() => setShowCreate(!showCreate)}
      className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
  );

  return (
    <div>
      <SectionHeader section="worktrees" icon={icon} label="Worktrees" count={worktrees.length} action={addBtn} />
      {!collapsed && (
        <>
          {showCreate && (
            <div className="p-3 border-b border-border space-y-2.5 animate-fade-in">
              <input
                className="w-full bg-surface-3 text-white text-xs px-2.5 py-1.5 rounded-md outline-none border border-border focus:border-accent/50 focus:shadow-glow-sm transition-all"
                placeholder="Branch name"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
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
            {worktrees.map((wt) => (
              <div key={wt.path} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-zinc-500 hover:bg-surface-2 group transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-zinc-400 font-medium">{wt.branch || 'detached'}</div>
                  <div className="truncate text-xxs text-zinc-700">{wt.path}</div>
                </div>
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
            ))}
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
