import { useState } from 'react';
import { useGitStore } from '../../stores/git';

interface Props {
  projectPath: string;
}

export default function WorktreeSection({ projectPath }: Props) {
  const worktrees = useGitStore((s) => s.worktrees);
  const addWorktree = useGitStore((s) => s.addWorktree);
  const removeWorktree = useGitStore((s) => s.removeWorktree);
  const [showCreate, setShowCreate] = useState(false);
  const [branch, setBranch] = useState('');
  const [createNew, setCreateNew] = useState(false);

  async function handleCreate() {
    if (!branch.trim()) return;
    const wtPath = `${projectPath}/../.worktrees/${branch.trim()}`;
    await addWorktree(projectPath, wtPath, branch.trim(), createNew);
    setBranch('');
    setCreateNew(false);
    setShowCreate(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400">Worktrees</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs text-zinc-500 hover:text-white"
        >
          +
        </button>
      </div>
      {showCreate && (
        <div className="p-2 border-b border-zinc-800 space-y-2">
          <input
            className="w-full bg-surface-3 text-white text-xs px-2 py-1 rounded outline-none border border-zinc-700 focus:border-accent"
            placeholder="Branch name"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <label className="flex items-center gap-2 text-xxs text-zinc-400">
            <input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} className="rounded" />
            Create new branch
          </label>
          <button
            onClick={handleCreate}
            className="w-full bg-accent hover:bg-accent-hover text-white text-xs py-1 rounded transition-colors"
          >
            Create Worktree
          </button>
        </div>
      )}
      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {worktrees.length === 0 && <div className="text-xxs text-zinc-600 px-1">No worktrees</div>}
        {worktrees.map((wt) => (
          <div key={wt.path} className="flex items-center gap-2 px-2 py-1 rounded text-xs text-zinc-400 hover:bg-surface-2 group">
            <div className="flex-1 min-w-0">
              <div className="truncate text-zinc-300">{wt.branch || 'detached'}</div>
              <div className="truncate text-xxs text-zinc-600">{wt.path}</div>
            </div>
            {!wt.isMain && (
              <button
                onClick={() => removeWorktree(projectPath, wt.path)}
                className="text-xxs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                title="Remove worktree"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
