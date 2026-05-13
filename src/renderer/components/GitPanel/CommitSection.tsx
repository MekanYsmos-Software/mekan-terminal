import { useGitStore } from '../../stores/git';
import SectionHeader from './SectionHeader';

export default function CommitSection() {
  const commits = useGitStore((s) => s.commits);
  const collapsed = useGitStore((s) => s.collapsed['commits']);

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash);
  }

  const icon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v4M8 11v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="flex flex-col min-h-0" style={{ flex: collapsed ? '0 0 auto' : '1 1 0' }}>
      <SectionHeader section="commits" icon={icon} label="Commits" count={commits.length} />
      {!collapsed && (
        <div className="p-2 space-y-0.5 flex-1 overflow-y-auto">
          {commits.length === 0 && <div className="text-xxs text-zinc-700 px-2 py-2">No commits</div>}
          {commits.map((c) => (
            <div
              key={c.hash}
              className="px-2.5 py-2 rounded-md text-xs hover:bg-surface-2 cursor-pointer transition-colors group"
              onClick={() => copyHash(c.hash)}
              title="Click to copy hash"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-accent/70 font-mono text-xxs group-hover:text-accent transition-colors">{c.hash}</span>
                <span className="text-xxs text-zinc-700">{c.relativeDate}</span>
              </div>
              <div className="text-zinc-400 truncate leading-snug">{c.message}</div>
              <div className="text-xxs text-zinc-700 mt-0.5">{c.author}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
