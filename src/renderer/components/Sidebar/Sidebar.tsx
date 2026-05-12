import { useEffect } from 'react';
import { useProjectsStore } from '../../stores/projects';
import ProjectItem from './ProjectItem';

export default function Sidebar() {
  const { projects, activeProjectId, loading, load, addProject, removeProject, renameProject, setActiveProject } =
    useProjectsStore();

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-zinc-800">
      <div className="p-3 flex items-center justify-between border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-300">Projects</span>
        <button
          onClick={addProject}
          className="w-6 h-6 flex items-center justify-center rounded bg-surface-3 text-zinc-400 hover:text-white hover:bg-accent transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && <div className="text-xs text-zinc-500 px-2 py-4">Loading...</div>}
        {!loading && projects.length === 0 && (
          <div className="text-xs text-zinc-500 px-2 py-4">No projects yet. Click + to add one.</div>
        )}
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            active={project.id === activeProjectId}
            onClick={() => setActiveProject(project.id)}
            onRename={(name) => renameProject(project.id, name)}
            onRemove={() => removeProject(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
