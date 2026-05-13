import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import { useGitStore } from '../../stores/git';

export default function StatusBar() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProjectName = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId)?.name ?? null);
  const allTerminals = useTerminalsStore((s) => s.terminals);
  const terminalCount = activeProjectId ? (allTerminals[activeProjectId] ?? []).filter((t) => !t.isServer).length : 0;
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);
  const togglePanel = useGitStore((s) => s.togglePanel);
  const panelOpen = useGitStore((s) => s.panelOpen);
  const currentBranch = branches.find((b) => b.current);

  return (
    <div className="h-7 bg-surface-1 border-t border-border px-3 flex items-center gap-3 text-xxs flex-shrink-0">
      {activeProjectName && (
        <>
          <span className="text-zinc-500 font-medium">{activeProjectName}</span>
          {currentBranch && (
            <span className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-zinc-600">
                <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="8" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v6" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="text-accent font-medium">{currentBranch.name}</span>
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.4)]" />}
            </span>
          )}
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-600 font-mono">{terminalCount}/6</span>
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={togglePanel}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium transition-all duration-200 ${
          panelOpen
            ? 'bg-accent/15 text-accent shadow-glow-sm'
            : 'text-zinc-600 hover:text-zinc-300 hover:bg-surface-2'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="4" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 5v4M6 11l2-2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Git
      </button>
    </div>
  );
}
