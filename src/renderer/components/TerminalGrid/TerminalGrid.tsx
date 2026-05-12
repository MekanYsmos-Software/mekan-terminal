import { useEffect } from 'react';
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import SplitNodeView from './SplitNode';

export default function TerminalGrid() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const layout = useTerminalsStore((s) => (activeProjectId ? s.layouts[activeProjectId] : null));
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);

  useEffect(() => {
    if (activeProjectId && activeProject && !layout) {
      spawnTerminal(activeProjectId, activeProject.path);
    }
  }, [activeProjectId, activeProject, layout, spawnTerminal]);

  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Select or add a project to get started.
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Starting terminal...
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0">
      <SplitNodeView node={layout} projectId={activeProjectId} cwd={activeProject.path} />
    </div>
  );
}
