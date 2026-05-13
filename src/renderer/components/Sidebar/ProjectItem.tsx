import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@shared/types';
import { useTerminalsStore } from '../../stores/terminals';
import { useProjectsStore } from '../../stores/projects';

interface Props {
  project: Project;
  active: boolean;
  onClick(): void;
  onRename(name: string): void;
  onRemove(): void;
  onToggleServer(): void;
  serverPopupOpen: boolean;
}

export default function ProjectItem({ project, active, onClick, onRename, onRemove, onToggleServer, serverPopupOpen }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editingServer, setEditingServer] = useState(false);
  const [serverCmd, setServerCmd] = useState(project.serverCommand || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const serverInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allTerminals = useTerminalsStore((s) => s.terminals);
  const projectTerminals = allTerminals[project.id] ?? [];
  const terminalCount = projectTerminals.filter((t) => !t.isServer).length;
  const serverTerminal = projectTerminals.find((t) => t.isServer);
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);
  const removeTerminal = useTerminalsStore((s) => s.removeTerminal);
  const setServerCommand = useProjectsStore((s) => s.setServerCommand);
  const setLogo = useProjectsStore((s) => s.setLogo);
  const clearLogo = useProjectsStore((s) => s.clearLogo);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    if (editingServer && serverInputRef.current) serverInputRef.current.focus();
  }, [editingServer]);

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

  function commitServerCommand() {
    const trimmed = serverCmd.trim();
    setServerCommand(project.id, trimmed);
    setEditingServer(false);
  }

  async function handleServerClick() {
    if (!project.serverCommand) return;
    if (!serverTerminal) {
      const id = await spawnTerminal(project.id, project.path, undefined, true);
      if (id) {
        setTimeout(() => {
          window.mekan.terminal.write(id, project.serverCommand + '\r');
        }, 500);
      }
    }
    onToggleServer();
  }

  function handleStopServer(e: React.MouseEvent) {
    e.stopPropagation();
    if (serverTerminal) {
      removeTerminal(project.id, serverTerminal.id);
    }
  }

  const serverStatus = serverTerminal?.status;

  return (
    <div
      className={`group relative flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-surface-3/80 text-white shadow-subtle ring-1 ring-accent/20'
          : 'text-zinc-400 hover:bg-surface-2/60 hover:text-zinc-200'
      }`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      {project.logo ? (
        <img src={`file://${project.logo}`} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0 ring-1 ring-white/5" />
      ) : (
        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors duration-200 ${
          active ? 'bg-accent/25 text-accent' : 'bg-surface-3 text-zinc-500'
        }`}>
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0 pt-0.5">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-surface-3 text-white text-sm px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent focus:shadow-glow-sm transition-all"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div className="text-sm font-medium truncate leading-tight">{project.name}</div>
        )}
        {editingServer ? (
          <input
            ref={serverInputRef}
            className="w-full bg-surface-3 text-white text-xxs px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent mt-1 transition-all"
            placeholder="e.g. npm run dev"
            value={serverCmd}
            onChange={(e) => setServerCmd(e.target.value)}
            onBlur={commitServerCommand}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitServerCommand();
              if (e.key === 'Escape') setEditingServer(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-xxs text-zinc-600 truncate mt-0.5">{project.path}</div>
        )}
        {project.serverCommand && !editingServer && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              className={`text-xxs px-2 py-0.5 rounded-md font-medium transition-all duration-200 ${
                serverStatus === 'running'
                  ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25 shadow-[0_0_8px_rgba(34,197,94,0.1)]'
                  : 'bg-surface-3 text-zinc-500 hover:text-white hover:bg-surface-4'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleServerClick();
              }}
              title={serverStatus === 'running' ? 'View server terminal' : 'Start server'}
            >
              {serverStatus === 'running' ? (serverPopupOpen && active ? '↓ Server' : '↑ Server') : '▶ Server'}
            </button>
            {serverStatus === 'running' && (
              <button
                className="text-xxs px-1.5 py-0.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                onClick={handleStopServer}
                title="Stop server"
              >
                ■
              </button>
            )}
          </div>
        )}
      </div>
      {terminalCount > 0 && (
        <span className="text-xxs text-zinc-600 font-mono flex-shrink-0 mt-1">{terminalCount}</span>
      )}

      {showMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-surface-2 border border-border-hover rounded-lg shadow-panel py-1.5 min-w-[180px] animate-fade-in"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors"
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
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setServerCmd(project.serverCommand || '');
              setEditingServer(true);
            }}
          >
            Configure Server
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setLogo(project.id);
            }}
          >
            Set Logo
          </button>
          {project.logo && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                clearLogo(project.id);
              }}
            >
              Remove Logo
            </button>
          )}
          <div className="border-t border-border my-1.5 mx-2" />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
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
