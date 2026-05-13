import { useGitStore } from '../../stores/git';
import SectionHeader from './SectionHeader';

export default function PullRequestSection() {
  const pullRequests = useGitStore((s) => s.pullRequests);
  const collapsed = useGitStore((s) => s.collapsed['prs']);

  function openPR(url: string) {
    window.mekan.shell.openExternal(url);
  }

  const icon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="11" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 6v6M11 10V6c0-1-1-2-2-2H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="flex flex-col min-h-0" style={{ flex: collapsed ? '0 0 auto' : '1 1 0' }}>
      <SectionHeader section="prs" icon={icon} label="Pull Requests" count={pullRequests.length} />
      {!collapsed && (
        <div className="p-2 space-y-0.5 flex-1 overflow-y-auto">
          {pullRequests.length === 0 && <div className="text-xxs text-zinc-700 px-2 py-2">No open PRs</div>}
          {pullRequests.map((pr) => (
            <div
              key={pr.number}
              className="px-2.5 py-2 rounded-md text-xs hover:bg-surface-2 cursor-pointer transition-colors group"
              onClick={() => openPR(pr.url)}
              title="Click to open on GitHub"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-green-500/70 font-mono text-xxs">#{pr.number}</span>
                {pr.draft && <span className="text-xxs text-zinc-600 bg-surface-3 px-1 rounded font-medium">Draft</span>}
                <span className="text-xxs text-zinc-700">{pr.author}</span>
              </div>
              <div className="text-zinc-400 truncate leading-snug group-hover:text-zinc-300 transition-colors">{pr.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
