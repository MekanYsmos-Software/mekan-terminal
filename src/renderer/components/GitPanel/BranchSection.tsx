import { useGitStore } from '../../stores/git';

export default function BranchSection() {
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400">Branches</span>
      </div>
      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {branches.length === 0 && <div className="text-xxs text-zinc-600 px-1">No git repository</div>}
        {branches.map((b) => (
          <div
            key={b.name}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
              b.current ? 'bg-surface-3 text-white' : 'text-zinc-400'
            }`}
          >
            <span className="truncate flex-1">{b.name}</span>
            {b.current && isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" title="Uncommitted changes" />
            )}
            {b.aheadBehind && (b.aheadBehind.ahead > 0 || b.aheadBehind.behind > 0) && (
              <span className="text-xxs text-zinc-500 flex-shrink-0">
                {b.aheadBehind.ahead > 0 && `↑${b.aheadBehind.ahead}`}
                {b.aheadBehind.behind > 0 && `↓${b.aheadBehind.behind}`}
              </span>
            )}
            {b.worktreePath && (
              <span className="text-xxs text-accent flex-shrink-0" title={b.worktreePath}>WT</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
