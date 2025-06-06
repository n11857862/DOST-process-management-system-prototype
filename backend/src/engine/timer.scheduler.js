const mongoose = require('mongoose');
const { WorkflowInstance } = require('../api/v1/instances/workflowInstance.model');
const { triggerExecution, addEngineEventToInstanceHistory } = require('./workflow.engine');
const Workflow = require('../api/v1/workflows/workflow.model');

let scheduledTask = null;
let timerInterval = null;

const checkAndResumeDueTimers = async () => {
    const now = new Date();
    console.log(`[TIMER_SCHEDULER] Running job to check for due timers at ${now.toISOString()}...`);

    let dueInstancesFound = 0;
    try {
        const dueInstances = await WorkflowInstance.find({
            status: 'WaitingForTimer',
            'timerResumeDetails.resumeAt': { $lte: now }
        }).limit(10);

        dueInstancesFound = dueInstances.length;

        if (dueInstancesFound > 0) {
            console.log(`[TIMER_SCHEDULER] Found ${dueInstancesFound} instance(s) with due timers.`);
        }

        for (const instance of dueInstances) {
            console.log(`[TIMER_SCHEDULER] Resuming instance ${instance._id} (timer node: ${instance.timerResumeDetails.timerNodeId}, due: ${instance.timerResumeDetails.resumeAt.toISOString()})`);
            const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
            if (!workflowDefinition) {
                console.error(`[TIMER_SCHEDULER] CRITICAL: WorkflowDefinition ${instance.workflowDefinitionId} not found for instance ${instance._id}. Cannot resume timer.`);
                instance.status = 'Failed';
                instance.errorInfo = {
                    message: `Timer resumption failed: Workflow definition missing for timer node ${instance.timerResumeDetails.timerNodeId}.`,
                    nodeId: instance.timerResumeDetails.timerNodeId,
                    timestamp: new Date()
                };
                instance.timerResumeDetails = undefined;
                await instance.save();
                continue;
            }
            try {
                const edgeIdToFollow = instance.timerResumeDetails.edgeToFollowId;
                let nextNodeIdToActivate = null;
                
                const timerNodeId = instance.timerResumeDetails.timerNodeId;
                const scheduledResumeAt = instance.timerResumeDetails.resumeAt;

                if (edgeIdToFollow) {
                    const edgeToFollow = workflowDefinition.flow.edges.find(e => e.id === edgeIdToFollow);
                    if (edgeToFollow) {
                        nextNodeIdToActivate = edgeToFollow.target;
                        const nextNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === nextNodeIdToActivate);

                        if (nextNodeDefinition && (nextNodeDefinition.data.type === 'ParallelJoin' || nextNodeDefinition.data.type === 'Join')) {
                            const joinNodeId = nextNodeDefinition.id;
                            if (!instance.joinStates) {
                                instance.joinStates = new Map();
                            }
                            let joinState = instance.joinStates.get(joinNodeId);
                            if (!joinState) {
                                joinState = { arrivedEdgeIds: [] };
                            }
                            if (!joinState.arrivedEdgeIds.includes(edgeIdToFollow)) {
                                joinState.arrivedEdgeIds.push(edgeIdToFollow);
                                console.log(`[TIMER_SCHEDULER] Edge ${edgeIdToFollow} (from resumed Timer ${timerNodeId}) recorded arrival at Join node ${joinNodeId}.`);
                            }
                            instance.joinStates.set(joinNodeId, joinState);
                            instance.markModified('joinStates');
                        }
                    } else {
                        console.error(`[TIMER_SCHEDULER] Edge ${edgeIdToFollow} (from timerResumeDetails) not found in definition for instance ${instance._id}. Cannot determine next step.`);
                        instance.status = 'Failed';
                        instance.errorInfo = {
                            message: `Timer resumption failed: Edge ${edgeIdToFollow} to follow from timer ${timerNodeId} missing in definition.`,
                            nodeId: timerNodeId,
                            timestamp: new Date()
                        };
                    }
                } else {
                     console.log(`[TIMER_SCHEDULER] Timer for node ${timerNodeId} in instance ${instance._id} had no outgoing edge to follow. Path ends here after timer.`);
                }

                instance.status = 'Running';
                instance.currentState.activeNodeIds = nextNodeIdToActivate ? [nextNodeIdToActivate] : [];
                instance.timerResumeDetails = undefined;
                instance.markModified('timerResumeDetails');
                instance.markModified('currentState.activeNodeIds');

                if (!instance.executionHistory) {
                    instance.executionHistory = [];
                }
                instance.executionHistory.push({
                    nodeId: timerNodeId,
                    nodeLabel: `Timer: ${timerNodeId || 'Unknown Timer'}`,
                    nodeType: 'Timer',
                    eventType: 'TimerResumed',
                    timestamp: now,
                    statusAtEvent: 'Running',
                    message: `Timer for node ${timerNodeId || 'Unknown Timer'} due at ${scheduledResumeAt?.toISOString()} has fired. Instance resuming.`,
                    details: {
                        timerNodeId: timerNodeId,
                        scheduledResumeAt: scheduledResumeAt?.toISOString(),
                        actualResumeAt: now.toISOString(),
                        edgeToFollow: edgeIdToFollow,
                        nextNodeToActivate: nextNodeIdToActivate
                    }
                });
                instance.markModified('executionHistory');

                try {
                    await instance.save();
                    console.log(`[TIMER_SCHEDULER] Successfully resumed instance ${instance._id} from timer ${timerNodeId}.`);
                } catch (saveError) {
                    if (saveError.name === 'VersionError') {
                        console.warn(`[TIMER_SCHEDULER] VersionError saving instance ${instance._id} after timer resumption. Attempting to refetch and retry...`);
                        
                        const freshInstance = await WorkflowInstance.findById(instance._id);
                        if (freshInstance && freshInstance.status === 'WaitingForTimer' && freshInstance.timerResumeDetails) {
                            freshInstance.status = 'Running';
                            freshInstance.currentState.activeNodeIds = nextNodeIdToActivate ? [nextNodeIdToActivate] : [];
                            freshInstance.timerResumeDetails = undefined;
                            freshInstance.markModified('timerResumeDetails');
                            freshInstance.markModified('currentState.activeNodeIds');
                            
                            if (!freshInstance.executionHistory) {
                                freshInstance.executionHistory = [];
                            }
                            freshInstance.executionHistory.push({
                                nodeId: timerNodeId,
                                nodeLabel: `Timer: ${timerNodeId || 'Unknown Timer'}`,
                                nodeType: 'Timer',
                                eventType: 'TimerResumed',
                                timestamp: now,
                                statusAtEvent: 'Running',
                                message: `Timer for node ${timerNodeId || 'Unknown Timer'} resumed after VersionError retry.`,
                                details: {
                                    timerNodeId: timerNodeId,
                                    scheduledResumeAt: scheduledResumeAt?.toISOString(),
                                    actualResumeAt: now.toISOString(),
                                    edgeToFollow: edgeIdToFollow,
                                    nextNodeToActivate: nextNodeIdToActivate,
                                    retryAfterVersionError: true
                                }
                            });
                            freshInstance.markModified('executionHistory');
                            
                            await freshInstance.save();
                            console.log(`[TIMER_SCHEDULER] Successfully resumed instance ${freshInstance._id} from timer ${timerNodeId} after retry.`);
                            
                            instance = freshInstance;
                        } else {
                                console.error(`[TIMER_SCHEDULER] Fresh instance ${instance._id} is no longer waiting for timer or timer details missing. Skipping.`);
                                continue;
                        }
                    } else {
                        throw saveError;
                    }
                }

                if (instance.status === 'Running' && instance.currentState.activeNodeIds.length > 0) {
                    triggerExecution(instance._id.toString()).catch(execError => {
                        console.error(`[TIMER_SCHEDULER] Error during triggerExecution for resumed instance ${instance._id}:`, execError);
                    });
                } else if (instance.status !== 'Failed') {
                     console.log(`[TIMER_SCHEDULER] Instance ${instance._id} timer resumed. Status: ${instance.status}. No active nodes to trigger engine or already failed.`);
                     if(instance.status === 'Running') triggerExecution(instance._id.toString());
                }

            } catch (error) {
                console.error(`[TIMER_SCHEDULER] Failed to process timer for instance ${instance._id}:`, error);
                
                try {
                    const freshInstance = await WorkflowInstance.findById(instance._id);
                    if (freshInstance) {
                        freshInstance.status = 'Failed';
                        freshInstance.errorInfo = {
                            message: `Failed to resume from timer node ${timerNodeId || 'unknown'}: ${error.message}`,
                            nodeId: timerNodeId,
                            timestamp: new Date()
                        };
                        freshInstance.timerResumeDetails = undefined;
                        await freshInstance.save();
                        console.log(`[TIMER_SCHEDULER] Marked instance ${freshInstance._id} as failed after timer error.`);
                    }
                } catch (failSaveError) {
                    console.error(`[TIMER_SCHEDULER] Error saving failed instance ${instance._id} after timer error:`, failSaveError);
                }
            }
        }
    } catch (error) {
        console.error('[TIMER_SCHEDULER] Error querying for due timer instances:', error);
    }
    if (dueInstancesFound === 0) {
    }
};

const startTimerScheduler = (cronExpressionParam) => {
    let intervalMs = 10000;
    
    if (cronExpressionParam && cronExpressionParam.startsWith('*/')) {
        const match = cronExpressionParam.match(/^\*\/(\d+)/);
        if (match) {
            intervalMs = parseInt(match[1]) * 1000;
        }
    }

    if (timerInterval) {
        console.warn('[TIMER_SCHEDULER] Timer scheduler is already running.');
        return;
    }

    console.log(`[TIMER_SCHEDULER] Starting timer scheduler with ${intervalMs}ms interval (${intervalMs/1000} seconds).`);
    
    try {
        timerInterval = setInterval(async () => {
            try {
                await checkAndResumeDueTimers();
            } catch (error) {
                console.error('[TIMER_SCHEDULER] Error in timer check:', error);
            }
        }, intervalMs);
        
        console.log('[TIMER_SCHEDULER] Timer scheduler started successfully using setInterval.');
    } catch (error) {
        console.error('[TIMER_SCHEDULER] Error starting timer scheduler:', error);
    }
};


const stopTimerScheduler = () => {
    if (timerInterval) {
        console.log('[TIMER_SCHEDULER] Stopping timer scheduler.');
        clearInterval(timerInterval);
        timerInterval = null;
    } else {
        console.log('[TIMER_SCHEDULER] Timer scheduler is not running.');
    }
};

module.exports = {
    startTimerScheduler,
    stopTimerScheduler,
    checkAndResumeDueTimers
};