import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import TerminalGrid from './components/TerminalGrid/TerminalGrid';
import GitPanel from './components/GitPanel/GitPanel';
import ServerTerminalPopup from './components/ServerTerminalPopup/ServerTerminalPopup';
import { useGitStore } from './stores/git';

export default function App() {
  const [serverPopupOpen, setServerPopupOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const setPanel = useGitStore((s) => s.setPanel);
  const panelOpen = useGitStore((s) => s.panelOpen);

  useEffect(() => {
    setRightOpen(panelOpen);
  }, [panelOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1000) {
        setPanel(false);
        setRightOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setPanel]);

  function toggleLeft() {
    setLeftOpen((v) => !v);
  }

  function toggleRight() {
    const next = !rightOpen;
    setRightOpen(next);
    setPanel(next);
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-0 text-zinc-200 overflow-hidden">
      {/* Title bar */}
      <div className="titlebar-drag h-10 bg-gradient-header border-b border-border flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="4" height="4" rx="0.5" fill="#6366f1" opacity="0.8"/>
              <rect x="5.5" y="0.5" width="4" height="4" rx="0.5" fill="#6366f1" opacity="0.5"/>
              <rect x="0.5" y="5.5" width="4" height="4" rx="0.5" fill="#6366f1" opacity="0.5"/>
              <rect x="5.5" y="5.5" width="4" height="4" rx="0.5" fill="#6366f1" opacity="0.3"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-zinc-500 tracking-wide uppercase">Mekan</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div
          className="flex-shrink-0 h-full transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
          style={{ width: leftOpen ? 248 : 40 }}
        >
          {leftOpen ? (
            <div className="w-[248px] h-full flex flex-col bg-gradient-sidebar">
              <Sidebar onToggleServer={() => setServerPopupOpen((v) => !v)} serverPopupOpen={serverPopupOpen} onCollapse={toggleLeft} />
            </div>
          ) : (
            <div
              className="w-10 h-full bg-surface-1 border-r border-border flex flex-col items-center pt-4 gap-3 cursor-pointer group transition-colors hover:bg-surface-2"
              onClick={toggleLeft}
              title="Expand projects"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-zinc-600 group-hover:text-accent transition-colors duration-200">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[0.6rem] text-zinc-600 group-hover:text-zinc-400 font-medium tracking-wider transition-colors duration-200" style={{ writingMode: 'vertical-rl' }}>PROJECTS</span>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <TerminalGrid />
          <ServerTerminalPopup open={serverPopupOpen} onClose={() => setServerPopupOpen(false)} />
        </div>

        {/* Right sidebar */}
        <div
          className="flex-shrink-0 h-full transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
          style={{ width: rightOpen ? 280 : 40 }}
        >
          {rightOpen ? (
            <div className="w-[280px] h-full">
              <GitPanel onCollapse={toggleRight} />
            </div>
          ) : (
            <div
              className="w-10 h-full bg-surface-1 border-l border-border flex flex-col items-center pt-4 gap-3 cursor-pointer group transition-colors hover:bg-surface-2"
              onClick={toggleRight}
              title="Expand git panel"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-zinc-600 group-hover:text-accent transition-colors duration-200">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[0.6rem] text-zinc-600 group-hover:text-zinc-400 font-medium tracking-wider transition-colors duration-200" style={{ writingMode: 'vertical-rl' }}>GIT</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
