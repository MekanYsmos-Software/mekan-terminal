import { useGitStore } from '../../stores/git';
import SectionHeader from './SectionHeader';

export default function BranchSection() {
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);
  const collapsed = useGitStore((s) => s.collapsed['branches']);

  const icon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5v6" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  return (
    <div>
      <SectionHeader section="branches" icon={icon} label="Branches" count={branches.length} />
      {!collapsed && (
        <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
          {branches.length === 0 && <div className="text-xxs text-zinc-700 px-2 py-2">No git repository</div>}
          {branches.map((b) => (
            <div
              key={b.name}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                b.current ? 'bg-surface-3/70 text-white ring-1 ring-accent/15' : 'text-zinc-500 hover:bg-surface-2 hover:text-zinc-300'
              }`}
            >
              <span className="truncate flex-1 font-medium">{b.name}</span>
              {b.current && isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.3)] flex-shrink-0" title="Uncommitted changes" />
              )}
              {b.aheadBehind && (b.aheadBehind.ahead > 0 || b.aheadBehind.behind > 0) && (
                <span className="text-xxs text-zinc-600 flex-shrink-0 font-mono">
                  {b.aheadBehind.ahead > 0 && <span className="text-green-500/70">↑{b.aheadBehind.ahead}</span>}
                  {b.aheadBehind.behind > 0 && <span className="text-red-400/70">↓{b.aheadBehind.behind}</span>}
                </span>
              )}
              {b.worktreePath && (
                <span className="text-xxs text-accent/60 flex-shrink-0 font-medium" title={b.worktreePath}>WT</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
