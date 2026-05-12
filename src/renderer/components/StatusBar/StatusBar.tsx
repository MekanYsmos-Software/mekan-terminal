import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import { useGitStore } from '../../stores/git';

export default function StatusBar() {
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const terminalCount = useTerminalsStore((s) =>
    activeProject ? (s.terminals[activeProject.id] || []).length : 0
  );
  const branches = useGitStore((s) => s.branches);
  const isDirty = useGitStore((s) => s.isDirty);
  const togglePanel = useGitStore((s) => s.togglePanel);
  const panelOpen = useGitStore((s) => s.panelOpen);
  const currentBranch = branches.find((b) => b.current);

  return (
    <div className="h-7 bg-surface-2 border-t border-zinc-800 px-3 flex items-center gap-4 text-xxs text-zinc-500 flex-shrink-0">
      {activeProject && (
        <>
          <span className="text-zinc-400">{activeProject.name}</span>
          {currentBranch && (
            <span className="flex items-center gap-1">
              <span className="text-accent">{currentBranch.name}</span>
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
            </span>
          )}
          <span>{terminalCount}/6 terminals</span>
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={togglePanel}
        className={`px-2 py-0.5 rounded transition-colors ${
          panelOpen ? 'bg-accent/20 text-accent' : 'hover:text-white'
        }`}
      >
        Git
      </button>
    </div>
  );
}
