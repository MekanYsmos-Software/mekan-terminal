import { useGitStore } from '../../stores/git';

export default function CommitSection() {
  const commits = useGitStore((s) => s.commits);

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash);
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400">Recent Commits</span>
      </div>
      <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
        {commits.length === 0 && <div className="text-xxs text-zinc-600 px-1">No commits</div>}
        {commits.map((c) => (
          <div
            key={c.hash}
            className="px-2 py-1 rounded text-xs hover:bg-surface-2 cursor-pointer"
            onClick={() => copyHash(c.hash)}
            title="Click to copy hash"
          >
            <div className="flex items-center gap-2">
              <span className="text-accent font-mono text-xxs">{c.hash}</span>
              <span className="text-xxs text-zinc-600">{c.relativeDate}</span>
            </div>
            <div className="text-zinc-400 truncate">{c.message}</div>
            <div className="text-xxs text-zinc-600">{c.author}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
