/**
 * Auto-layout a workflow graph top-to-bottom using Dagre.
 *
 * We use rough node-size estimates that match the actual rendered card
 * (220–260 px wide, ~96 px tall) so spacing feels right without measuring
 * the DOM.
 */
import dagre from "@dagrejs/dagre";
import type { WorkflowEdge, WorkflowNode } from "./types";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

export function autoLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  direction: "TB" | "LR" = "TB",
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 70,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const layout = g.node(node.id);
    if (!layout) return node;
    return {
      ...node,
      // React Flow positions are top-left of the node; Dagre returns centres.
      position: {
        x: layout.x - NODE_WIDTH / 2,
        y: layout.y - NODE_HEIGHT / 2,
      },
    };
  });
}
