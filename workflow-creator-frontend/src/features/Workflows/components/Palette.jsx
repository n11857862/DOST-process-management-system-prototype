
import React from 'react';
import {
    Briefcase,
    GitBranch,
    UserCheck,
    Zap,
    FileUp,
    Workflow,
    PlayCircle,
    StopCircle,
    Bell,
    Clock,
    Split,
    GitMerge
} from 'lucide-react';

const paletteNodeTypes = [
  {
    id: 'start',
    type: 'Start', label: 'Start Event', icon: PlayCircle, color: '#e8eaf6',
    data: { type: 'Start', reactFlowType: 'input', label: 'Start' }
  },
  {
    id: 'task',
    type: 'Task', 
    label: 'Task', 
    icon: Briefcase, 
    color: '#eef2ff',
    data: { 
      type: 'Task', 
      reactFlowType: 'task', 
      config: { 
        assignTo: 'initiator',
        priority: 'Medium',
        formFields: [] 
      } 
    }
  },
  {
    id: 'decision',
    type: 'Decision', label: 'Decision', icon: GitBranch, color: '#fffbeb',
    data: { type: 'Decision', reactFlowType: 'decision', config: {} }
  },
{
        id: 'approval',
        type: 'Approval',
        label: 'Approval',
        icon: UserCheck,
        color: '#e0f7fa',
        data: {
            type: 'Approval',
            reactFlowType: 'approval',
            label: 'Approval Step',
            config: {
                approverRule: 'Manager',
                rejectionBehavior: 'followRejectedPath',
                instructions: '',
                priority: 'Medium'
            }
        }
    },
   {
    id: 'automatedTask',
    type: 'AutomatedTask', 
    label: 'API / Auto Task', 
    icon: Zap, 
    color: '#f5f3ff',
    data: { 
      type: 'AutomatedTask', 
      reactFlowType: 'automatedTask', 
      config: { 
        apiMethod: 'POST',
        apiConfigName: '',
        apiConfigDescription: '',
        apiUrl: '',
        apiHeaders: '{}',
        apiPayloadTemplate: '{}',
        apiConfigId: null,
        apiConfigStatus: ''
      } 
    }
  },
{
    id: 'fileUpload',
    type: 'FileUpload',
    label: 'Attach File (for Review Task)',
    icon: FileUp, 
    color: '#E0F2FE',
    data: { 
      type: 'FileUpload',
      reactFlowType: 'fileUpload',
      label: 'Review Attached Document',
      description: '',
      config: { 
        designerAttachedFileId: null,
        designerAttachedFileName: '',
        contextKeyForFileId: 'attachedDocumentId',
        instructions: 'Please download, review the attached document, and then complete this task.',
        assignTo: 'initiator',
        priority: 'Medium',
      } 
    }
  },
   {
    id: 'subWorkflow',
    type: 'SubWorkflow', label: 'Sub-Workflow', icon: Workflow, color: '#fdf2f8',
    data: { 
    type: 'SubWorkflow', 
    reactFlowType: 'subWorkflow', 
    label: 'Sub-Workflow Step',
    config: { 
        waitForCompletion: true,
        subWorkflowId: '',
        selectedSubWorkflowName: '',
        inputMapping: {},
        outputMapping: {}
    } 
}
  },
  {
    id: 'notification',
    type: 'Notification',
    label: 'Notification',
    icon: Bell,
    color: '#f0f9ff',
    data: { 
        type: 'Notification',
        reactFlowType: 'notification',
        label: 'Send Notification',
        config: {
            notificationType: 'log',
            recipientType: 'initiator',
            recipientValue: '',
            subjectTemplate: 'Workflow Notification: {{workflowName}}',
            bodyTemplate: 'Instance {{instanceId}} requires your attention at node {{nodeId}}.\n\nContext: {{context.details}}',
            logMessageTemplate: 'Notification from {{workflowName}} (Instance: {{instanceId}}, Node: {{nodeId}}): {{message}}',
            message: 'A notification event occurred.'
        } 
    }
},
{
        id: 'timer',
        type: 'Timer',
        label: 'Timer / Delay',
        icon: Clock, 
        color: '#cffafe',
        data: { 
            type: 'Timer',
            reactFlowType: 'timer',
            label: 'Wait Step',
            config: {
                timerType: 'duration', 
                delayValue: 30,      
                delayUnit: 'minutes',
                specificResumeAt: '',
                resumeAtContextVar: ''
            } 
        }
    },
    {
        id: 'parallelSplit',
        label: 'Parallel Split',
        type: 'ParallelSplit',
        icon: Split,
        description: 'Splits the flow into multiple parallel paths.',
        color: '#dbeafe',
        data: {
            label: 'Split',
            type: 'ParallelSplit',
            reactFlowType: 'parallelSplitCustom'
        }
    },
    {
        id: 'parallelJoin',
        label: 'Parallel Join',
        type: 'ParallelJoin',
        icon: GitMerge,
        description: 'Synchronizes multiple parallel paths.',
        color: '#d1fae5',
        data: {
            label: 'Join',
            type: 'ParallelJoin',
            reactFlowType: 'parallelJoinCustom'
        }
    },
  {
    id: 'end',
    type: 'End', label: 'End Event', icon: StopCircle, color: '#fce4ec',
    data: { type: 'End', reactFlowType: 'output', label: 'End' }
  },
];

export const Palette = ({ isCollapsed }) => {
    const onDragStart = (event, nodeData) => {
        const { data, label } = nodeData; 
        event.dataTransfer.setData('application/reactflow-nodetype', data.reactFlowType); 
        event.dataTransfer.setData('application/reactflow-label', data.label || label); 
        event.dataTransfer.setData('application/reactflow-data', JSON.stringify(data || {}));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <>
            {paletteNodeTypes.map((nodeItem) => { 
                const IconComponent = nodeItem.icon; 
                return (
                    <div
                        key={nodeItem.id}
                        className={`
                            mb-2 p-2 rounded-md border border-gray-300 shadow-sm cursor-grab
                            hover:shadow-md hover:border-blue-400 hover:bg-gray-50
                            transition-all duration-150 ease-in-out
                            flex items-center text-sm text-gray-700 font-medium
                            ${isCollapsed ? 'justify-center' : ''}
                        `}
                        style={{ backgroundColor: nodeItem.color || '#ffffff' }}
                        onDragStart={(event) => onDragStart(event, nodeItem)}
                        draggable
                        title={nodeItem.label}
                    >
                        {IconComponent && (
                            <IconComponent 
                                size={isCollapsed ? 20 : 18}
                                className={`${isCollapsed ? '' : 'mr-2'} flex-shrink-0 text-gray-600`}
                            />
                        )}
                        {!isCollapsed && <span>{nodeItem.label}</span>}
                    </div>
                );
            })}
        </>
    );
};


export default Palette; 
