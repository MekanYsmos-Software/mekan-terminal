import { useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { useGitStore } from '../../stores/git';
import type { DirEntry } from '@shared/types';

function TreeNode({ entry, parentPath, depth }: { entry: DirEntry; parentPath: string; depth: number }) {
  const fullPath = parentPath + '\\' + entry.name;
  const expanded = useFilesStore((s) => s.expandedDirs.has(fullPath));
  const children = useFilesStore((s) => s.dirContents[fullPath]);
  const toggleDir = useFilesStore((s) => s.toggleDir);
  const openFile = useFilesStore((s) => s.openFile);
  const activeTabPath = useFilesStore((s) => s.activeTabPath);
  const isActive = entry.type === 'file' && activeTabPath === fullPath;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-0.5 text-xxs hover:bg-surface-3 transition-colors rounded-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleDir(fullPath)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-500/70">
            <path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8.5 4.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="currentColor"/>
          </svg>
          <span className="truncate text-zinc-400">{entry.name}</span>
        </button>
        {expanded && children && (
          <div>
            {children.map((child) => (
              <TreeNode key={child.name} entry={child} parentPath={fullPath} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={`flex items-center gap-1 w-full text-left px-2 py-0.5 text-xxs transition-colors rounded-sm ${
        isActive ? 'bg-accent/15 text-white' : 'text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => openFile(fullPath, entry.name)}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-0">
        <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-zinc-600">
        <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

interface Props {
  projectPath: string;
}

export default function FileTree({ projectPath }: Props) {
  const rootPath = useFilesStore((s) => s.rootPath);
  const rootEntries = useFilesStore((s) => (s.rootPath ? s.dirContents[s.rootPath] : undefined));
  const setRootPath = useFilesStore((s) => s.setRootPath);
  const worktrees = useGitStore((s) => s.worktrees);

  useEffect(() => {
    if (!rootPath) {
      setRootPath(projectPath);
    }
  }, [projectPath, rootPath, setRootPath]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {worktrees.length > 1 && (
        <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
          <select
            className="w-full bg-surface-3 text-xxs text-zinc-300 rounded-md px-2 py-1 border border-border outline-none focus:border-accent transition-colors"
            value={rootPath || projectPath}
            onChange={(e) => setRootPath(e.target.value)}
          >
            {worktrees.map((wt) => (
              <option key={wt.path} value={wt.path}>
                {wt.branch || 'detached'} — {wt.isMain ? 'main' : wt.path.split(/[\\/]/).pop()}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-1">
        {rootEntries ? (
          rootEntries.map((entry) => (
            <TreeNode key={entry.name} entry={entry} parentPath={rootPath || projectPath} depth={0} />
          ))
        ) : (
          <div className="text-xxs text-zinc-600 px-3 py-4 text-center animate-pulse-subtle">Loading...</div>
        )}
      </div>
    </div>
  );
}
