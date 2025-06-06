
import { TaskNode } from './TaskNode.jsx';
import { DecisionNode } from './DecisionNode.jsx';
import { ApprovalNode } from './ApprovalNode.jsx';
import { AutomatedTaskNode } from './AutomatedTaskNode.jsx';
import { FileUploadNode } from './FileUploadNode.jsx';
import { SubworkflowNode } from './SubworkflowNode.jsx';
import { StartNode } from './StartNode.jsx';
import { EndNode } from './EndNode.jsx';
import { NotificationNode } from './NotificationNode.jsx';
import { TimerNode } from './TimerNode.jsx';
import { ParallelSplitNode } from './ParallelSplitNode';
import { ParallelJoinNode } from './ParallelJoinNode';


export const nodeTypes = {
  task: TaskNode,
  decision: DecisionNode,
  approval: ApprovalNode,
  automatedTask: AutomatedTaskNode,
  fileUpload: FileUploadNode,
  subWorkflow: SubworkflowNode,
  notification: NotificationNode,
  timer: TimerNode, 
  parallelSplitCustom: ParallelSplitNode,
  parallelJoinCustom: ParallelJoinNode,

  input: StartNode,
  output: EndNode,
  default: TaskNode,
};
