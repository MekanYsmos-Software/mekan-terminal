import { useEffect, useState } from 'react';
import appIcon from './assets/icon.png';
import Sidebar from './components/Sidebar/Sidebar';
import TerminalGrid from './components/TerminalGrid/TerminalGrid';
import GitPanel from './components/GitPanel/GitPanel';
import ServerTerminalPopup from './components/ServerTerminalPopup/ServerTerminalPopup';
import { useGitStore } from './stores/git';

export default function App() {
  const [serverPopupOpen, setServerPopupOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const setPanel = useGitStore((s) => s.setPanel);
  const panelOpen = useGitStore((s) => s.panelOpen);

  useEffect(() => {
    const offAvailable = window.mekan.updater.onUpdateAvailable((version) => {
      setUpdateVersion(version);
    });
    const offDownloaded = window.mekan.updater.onUpdateDownloaded((version) => {
      setUpdateVersion(version);
      setUpdateReady(true);
    });
    return () => { offAvailable(); offDownloaded(); };
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1000) {
        setPanel(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setPanel]);

  function toggleLeft() {
    setLeftOpen((v) => !v);
  }

  function toggleRight() {
    setPanel(!panelOpen);
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-0 text-zinc-200 overflow-hidden">
      {/* Title bar */}
      <div className="titlebar-drag h-10 bg-gradient-header border-b border-border flex items-center justify-between pl-4 flex-shrink-0" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2">
          <img src={appIcon} alt="Mekan" className="w-5 h-5 rounded" />
          <span className="text-xs font-semibold text-zinc-500 tracking-wide uppercase">Mekan Terminal</span>
        </div>
        {/* Window controls */}
        <div className="titlebar-no-drag flex items-center h-full">
          <button
            onClick={() => window.mekan.window.minimize()}
            className="w-11 h-10 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-default outline-none"
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor"/>
            </svg>
          </button>
          <button
            onClick={() => window.mekan.window.maximize()}
            className="w-11 h-10 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-default outline-none"
            title="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
          <button
            onClick={() => window.mekan.window.close()}
            className="w-11 h-10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-500/80 transition-colors cursor-default outline-none"
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {updateVersion && (
        <div className="flex items-center justify-center gap-3 px-4 py-1.5 bg-accent/15 border-b border-accent/30 flex-shrink-0">
          <span className="text-xs text-zinc-300">
            {updateReady
              ? `Version ${updateVersion} ready to install`
              : `Downloading version ${updateVersion}...`}
          </span>
          {updateReady ? (
            <button
              onClick={() => window.mekan.updater.install()}
              className="px-3 py-0.5 text-xs font-medium rounded bg-accent hover:bg-accent/80 text-white transition-colors"
            >
              Restart and update
            </button>
          ) : (
            <div className="w-3 h-3 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          )}
        </div>
      )}

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
          style={{ width: panelOpen ? 280 : 40 }}
        >
          {panelOpen ? (
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
