import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import FileTree from './FileTree';
import EditorTabs from './EditorTabs';
import FileEditor from './FileEditor';

interface Props {
  projectPath: string;
}

export default function FilesView({ projectPath }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <Allotment>
        <Allotment.Pane preferredSize={250} minSize={150} maxSize={450}>
          <FileTree projectPath={projectPath} />
        </Allotment.Pane>
        <Allotment.Pane>
          <div className="flex flex-col h-full min-h-0">
            <EditorTabs />
            <div className="flex-1 min-h-0">
              <FileEditor />
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
