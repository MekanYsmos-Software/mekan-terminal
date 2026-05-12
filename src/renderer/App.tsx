import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import TerminalGrid from './components/TerminalGrid/TerminalGrid';
import GitPanel from './components/GitPanel/GitPanel';
import StatusBar from './components/StatusBar/StatusBar';
import { useGitStore } from './stores/git';

export default function App() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const setPanel = useGitStore((s) => s.setPanel);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      setWindowWidth(w);
      if (w < 1000) setPanel(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setPanel]);

  const collapsed = windowWidth < 800;

  return (
    <div className="flex h-screen w-screen bg-surface-0 text-zinc-200 overflow-hidden">
      <div className={collapsed ? 'w-12' : 'w-60'} style={{ flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex min-h-0">
          <TerminalGrid />
          <GitPanel />
        </div>
        <StatusBar />
      </div>
    </div>
  );
}
