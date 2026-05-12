import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { LayoutNode } from '@shared/types';
import TerminalPane from '../TerminalPane/TerminalPane';

interface Props {
  node: LayoutNode;
  projectId: string;
  cwd: string;
}

export default function SplitNodeView({ node, projectId, cwd }: Props) {
  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} projectId={projectId} cwd={cwd} />;
  }

  return (
    <Allotment vertical={node.direction === 'horizontal'} defaultSizes={node.sizes}>
      {node.children.map((child, i) => (
        <Allotment.Pane key={child.type === 'leaf' ? child.terminalId : i} minSize={child.type === 'leaf' ? 120 : 80}>
          <SplitNodeView node={child} projectId={projectId} cwd={cwd} />
        </Allotment.Pane>
      ))}
    </Allotment>
  );
}
