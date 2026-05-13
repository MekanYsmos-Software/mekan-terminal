import { useEffect, useRef, useState } from 'react';
import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import ProjectItem from './ProjectItem';

interface Props {
  onToggleServer(): void;
  serverPopupOpen: boolean;
  onCollapse(): void;
}

export default function Sidebar({ onToggleServer, serverPopupOpen, onCollapse }: Props) {
  const { projects, activeProjectId, loading, load, addProject, removeProject, renameProject, reorderProjects, setActiveProject } =
    useProjectsStore();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const loadSavedCounts = useTerminalsStore((s) => s.loadSavedCounts);
  const notifiedProjectIds = useTerminalsStore((s) => s.notifiedProjectIds);
  const clearNotification = useTerminalsStore((s) => s.clearNotification);

  useEffect(() => {
    load().then(() => {
      const ids = useProjectsStore.getState().projects.map((p) => p.id);
      loadSavedCounts(ids);
    });
  }, [load, loadSavedCounts]);

  function handleDragStart(idx: number) {
    setDragIdx(idx);
    dragRef.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function handleDrop(idx: number) {
    const from = dragRef.current;
    if (from !== null && from !== idx) {
      const reordered = [...projects];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(idx, 0, moved);
      reorderProjects(reordered.map((p) => p.id));
    }
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  }

  function handleDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  }

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onCollapse}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-accent hover:bg-surface-3 transition-all"
            title="Collapse sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Projects</span>
        </div>
        <button
          onClick={addProject}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-3 text-zinc-500 hover:text-white hover:bg-accent hover:shadow-glow-sm transition-all duration-200 text-sm leading-none"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {loading && (
          <div className="text-xs text-zinc-600 px-2 py-6 text-center animate-pulse-subtle">Loading...</div>
        )}
        {!loading && projects.length === 0 && (
          <div className="text-xs text-zinc-600 px-3 py-8 text-center leading-relaxed">
            No projects yet.<br />
            <span className="text-zinc-500">Click + to add one.</span>
          </div>
        )}
        {projects.map((project, idx) => (
          <div
            key={project.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={`transition-all duration-150 ${overIdx === idx && dragIdx !== idx ? 'border-t-2 border-accent' : 'border-t-2 border-transparent'} ${dragIdx === idx ? 'opacity-30 scale-95' : ''}`}
          >
            <ProjectItem
              project={project}
              active={project.id === activeProjectId}
              notified={notifiedProjectIds.has(project.id)}
              onClick={() => {
                setActiveProject(project.id);
                clearNotification(project.id);
              }}
              onRename={(name) => renameProject(project.id, name)}
              onRemove={() => removeProject(project.id)}
              onToggleServer={onToggleServer}
              serverPopupOpen={serverPopupOpen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
