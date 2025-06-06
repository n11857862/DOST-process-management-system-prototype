export const translateFlowToSteps = (flowNodes = [], flowEdges = []) => {
    const steps = [];
    const errors = [];
    const visited = new Set();
    const stepOrderMap = new Map();
  
    if (!flowNodes || flowNodes.length === 0) {
      errors.push("Workflow is empty. Add some nodes.");
      return { steps, errors };
    }
  
    const nodeMap = new Map(flowNodes.map(node => [node.id, node]));
    const outgoingEdgesMap = new Map();
    const incomingEdgesMap = new Map();
  
    flowEdges.forEach(edge => {
      if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
          errors.push(`Edge '${edge.id || `${edge.source}->${edge.target}`}' connects to non-existent node(s).`);
          return;
      }
      const sourceEdges = outgoingEdgesMap.get(edge.source) || [];
      outgoingEdgesMap.set(edge.source, [...sourceEdges, edge]);
      const targetEdges = incomingEdgesMap.get(edge.target) || [];
      incomingEdgesMap.set(edge.target, [...targetEdges, edge]);
    });
  
    const startNodes = flowNodes.filter(node => node.type === 'input' || (!incomingEdgesMap.has(node.id) && outgoingEdgesMap.has(node.id)));
    if (startNodes.length === 0) {
      errors.push("No start node found. Add a node with no incoming connections or type 'input'.");
      return { steps, errors };
    }
    if (startNodes.length > 1) {
      errors.push(`Multiple start nodes found (${startNodes.map(n => n.id).join(', ')}). Only one start node is allowed.`);
    }
    const startNode = startNodes[0];
  
    const endNodes = flowNodes.filter(node => !outgoingEdgesMap.has(node.id) && node.type !== 'input');
    if (endNodes.length === 0 && flowNodes.length > 1) {
        errors.push("No end node(s) found. Ensure all paths terminate.");
    }
  
  
    let currentOrder = 0;
    const traversalStack = [{ nodeId: startNode.id, path: [startNode.id] }];
  
    while (traversalStack.length > 0) {
      const { nodeId, path } = traversalStack.pop();
  
      const currentNode = nodeMap.get(nodeId);
      if (!currentNode) {
          errors.push(`Traversal error: Node ID '${nodeId}' not found in node map.`);
          continue;
      }
  
      if (stepOrderMap.has(nodeId)) {
          continue;
      }
  
      let isStep = false;
      if (currentNode.type !== 'input' && currentNode.type !== 'output') {
          if (!currentNode.data?.label) {
              errors.push(`Node '${nodeId}' is missing a label/name in its data.`);
          }
          if (!currentNode.data?.type) {
               errors.push(`Node '${nodeId}' is missing a 'type' in its data (e.g., 'Task', 'Approval').`);
          }
  
          const stepData = {
              name: currentNode.data?.label || `Node ${nodeId}`,
              order: currentOrder,
              type: currentNode.data?.type || currentNode.type || 'Task',
              description: currentNode.data?.description || '',
              config: currentNode.data?.config || {},
          };
  
          if (stepData.type.toLowerCase() === 'condition') {
               const branches = (outgoingEdgesMap.get(nodeId) || []).map(edge => ({
                  conditionLabel: edge.data?.conditionLabel || `Path to ${edge.target}`,
                  targetNodeId: edge.target,
               }));
               stepData.config.branches = branches;
          }
  
          steps.push(stepData);
          stepOrderMap.set(nodeId, currentOrder);
          currentOrder++;
          isStep = true;
      } else if (currentNode.type === 'input') {
          stepOrderMap.set(nodeId, -1);
      }
  
      const outgoingEdges = outgoingEdgesMap.get(nodeId) || [];
  
      if (outgoingEdges.length === 0 && currentNode.type !== 'output') {
          errors.push(`Path terminates unexpectedly at node '${nodeId}' ('${currentNode.data?.label}'). Connect it to an End node or another step.`);
      }
  
      for (let i = outgoingEdges.length - 1; i >= 0; i--) {
          const edge = outgoingEdges[i];
          const targetNodeId = edge.target;
  
          if (path.includes(targetNodeId)) {
              errors.push(`Cycle detected: Path goes back to node '${targetNodeId}' from '${nodeId}'.`);
              continue;
          }
  
          if (!stepOrderMap.has(targetNodeId) || targetNodeId === startNode.id) {
               traversalStack.push({ nodeId: targetNodeId, path: [...path, targetNodeId] });
          }
      }
    }
  
    flowNodes.forEach(node => {
        if (node.type !== 'output' && !stepOrderMap.has(node.id)) {
            errors.push(`Node '${node.id}' ('${node.data?.label}') is disconnected or unreachable from the start node.`);
        }
    });
  
  
    console.log("Translation Result:", { steps, errors });
    steps.sort((a, b) => a.order - b.order);
    return { steps, errors };
  };