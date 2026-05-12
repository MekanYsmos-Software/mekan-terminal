import { useEffect, useRef } from 'react';
import { useGitStore } from '../../stores/git';
import { useProjectsStore } from '../../stores/projects';
import BranchSection from './BranchSection';
import WorktreeSection from './WorktreeSection';
import CommitSection from './CommitSection';

export default function GitPanel() {
  const panelOpen = useGitStore((s) => s.panelOpen);
  const refresh = useGitStore((s) => s.refresh);
  const loading = useGitStore((s) => s.loading);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    refresh(activeProject.path);

    intervalRef.current = setInterval(() => {
      refresh(activeProject.path);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeProject, refresh]);

  if (!panelOpen || !activeProject) return null;

  return (
    <div className="w-[280px] bg-surface-1 border-l border-zinc-800 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800" style={{ marginTop: 36 }}>
        <span className="text-sm font-semibold text-zinc-300">Git</span>
        {loading && <span className="text-xxs text-zinc-500">refreshing...</span>}
        <button
          onClick={() => activeProject && refresh(activeProject.path)}
          className="text-xs text-zinc-500 hover:text-white"
          title="Refresh"
        >
          ↻
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <BranchSection />
        <WorktreeSection projectPath={activeProject.path} />
        <CommitSection />
      </div>
    </div>
  );
}
