import { useRef, useCallback, useEffect } from 'react';
import Editor, { loader, type Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useFilesStore } from '../../stores/files';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    const getWorkerModule = (moduleUrl: string) => {
      return new Worker(new URL(moduleUrl, import.meta.url), { type: 'module' });
    };
    switch (label) {
      case 'json': return getWorkerModule('monaco-editor/esm/vs/language/json/json.worker?worker');
      case 'css':
      case 'scss':
      case 'less': return getWorkerModule('monaco-editor/esm/vs/language/css/css.worker?worker');
      case 'html':
      case 'handlebars':
      case 'razor': return getWorkerModule('monaco-editor/esm/vs/language/html/html.worker?worker');
      case 'typescript':
      case 'javascript': return getWorkerModule('monaco-editor/esm/vs/language/typescript/ts.worker?worker');
      default: return getWorkerModule('monaco-editor/esm/vs/editor/editor.worker?worker');
    }
  },
};

loader.config({ monaco });

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html',
  yml: 'yaml', yaml: 'yaml', py: 'python', rs: 'rust', go: 'go',
  sh: 'shell', bash: 'shell', ps1: 'powershell', sql: 'sql',
  xml: 'xml', svg: 'xml', toml: 'ini', env: 'ini', gitignore: 'plaintext',
};

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_LANGUAGE[ext] || 'plaintext';
}

export default function FileEditor() {
  const activeTab = useFilesStore((s) => s.openTabs.find((t) => t.filePath === s.activeTabPath));
  const updateContent = useFilesStore((s) => s.updateContent);
  const saveFile = useFilesStore((s) => s.saveFile);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleMount = useCallback((ed: monaco.editor.IStandaloneCodeEditor, _monaco: Monaco) => {
    editorRef.current = ed;
    ed.addCommand(_monaco.KeyMod.CtrlCmd | _monaco.KeyCode.KeyS, () => {
      const path = useFilesStore.getState().activeTabPath;
      if (path) saveFile(path);
    });
  }, [saveFile]);

  const handleChange = useCallback((value: string | undefined) => {
    if (value === undefined || !activeTab) return;
    updateContent(activeTab.filePath, value);
  }, [activeTab?.filePath, updateContent]);

  useEffect(() => {
    if (editorRef.current && activeTab) {
      editorRef.current.focus();
    }
  }, [activeTab?.filePath]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-sm text-zinc-600">Select a file to edit</div>
      </div>
    );
  }

  return (
    <Editor
      key={activeTab.filePath}
      defaultValue={activeTab.content}
      language={getLanguage(activeTab.name)}
      theme="mekan-dark"
      onMount={handleMount}
      onChange={handleChange}
      beforeMount={(monaco) => {
        monaco.editor.defineTheme('mekan-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#09090b',
            'editor.foreground': '#d4d4d8',
            'editorCursor.foreground': '#6366f1',
            'editor.selectionBackground': '#6366f130',
            'editor.lineHighlightBackground': '#18181b',
            'editorLineNumber.foreground': '#3f3f46',
            'editorLineNumber.activeForeground': '#71717a',
            'editorWidget.background': '#18181b',
            'editorWidget.border': '#27272a',
            'input.background': '#18181b',
            'input.border': '#27272a',
            'scrollbar.shadow': '#00000000',
            'scrollbarSlider.background': '#27272a80',
            'scrollbarSlider.hoverBackground': '#3f3f4680',
          },
        });
      }}
      options={{
        fontSize: 14,
        fontFamily: "'Cascadia Mono', 'Cascadia Code', 'Consolas', monospace",
        lineHeight: 1.6,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        padding: { top: 8 },
        renderLineHighlight: 'gutter',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorWidth: 2,
      }}
    />
  );
}
