import { useEffect, useRef } from 'react';
import { useGitStore } from '../../stores/git';
import { useProjectsStore } from '../../stores/projects';
import BranchSection from './BranchSection';
import WorktreeSection from './WorktreeSection';
import CommitSection from './CommitSection';
import PullRequestSection from './PullRequestSection';

export default function GitPanel({ onCollapse }: { onCollapse(): void }) {
  const refresh = useGitStore((s) => s.refresh);
  const loading = useGitStore((s) => s.loading);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? null);
  const activeProjectPath = activeProject?.path ?? null;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshPRs = useGitStore((s) => s.refreshPRs);
  const prIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeProjectPath) return;
    refresh(activeProjectPath);
    refreshPRs(activeProjectPath);

    intervalRef.current = setInterval(() => {
      refresh(activeProjectPath);
    }, 5000);

    prIntervalRef.current = setInterval(() => {
      refreshPRs(activeProjectPath);
    }, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (prIntervalRef.current) clearInterval(prIntervalRef.current);
    };
  }, [activeProjectPath, refresh, refreshPRs]);

  if (!activeProject || !activeProjectPath) return null;

  return (
    <div className="w-full bg-gradient-sidebar border-l border-border flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Git</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCollapse}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-accent hover:bg-surface-3 transition-all"
            title="Collapse git panel"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {loading && (
            <div className="w-3 h-3 rounded-full border border-accent/40 border-t-accent animate-spin" />
          )}
          <button
            onClick={() => activeProjectPath && refresh(activeProjectPath)}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-surface-3 transition-all"
            title="Refresh"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0110.89-3.48M14 8a6 6 0 01-10.89 3.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <BranchSection />
        <WorktreeSection project={activeProject} />
        <PullRequestSection />
        <CommitSection />
      </div>
    </div>
  );
}
