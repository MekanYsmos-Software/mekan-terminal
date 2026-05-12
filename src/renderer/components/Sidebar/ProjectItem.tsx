import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@shared/types';
import { useTerminalsStore } from '../../stores/terminals';

interface Props {
  project: Project;
  active: boolean;
  onClick(): void;
  onRename(name: string): void;
  onRemove(): void;
}

export default function ProjectItem({ project, active, onClick, onRename, onRemove }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const terminalCount = useTerminalsStore((s) => (s.terminals[project.id] || []).length);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const initial = project.name.charAt(0).toUpperCase();

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  }

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      className={`group relative flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
        active ? 'bg-surface-3 text-white' : 'text-zinc-400 hover:bg-surface-2 hover:text-zinc-200'
      }`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div className="w-7 h-7 rounded bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-surface-3 text-white text-sm px-1 py-0.5 rounded outline-none border border-accent"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div className="text-sm truncate">{project.name}</div>
        )}
        <div className="text-xxs text-zinc-500 truncate">{project.path}</div>
      </div>
      {terminalCount > 0 && (
        <span className="text-xxs text-zinc-500 flex-shrink-0">{terminalCount}</span>
      )}

      {showMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-surface-2 border border-zinc-700 rounded shadow-lg py-1 min-w-[140px]"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-surface-3"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setEditName(project.name);
              setEditing(true);
            }}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-surface-3"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              onRemove();
            }}
          >
            Remove
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
