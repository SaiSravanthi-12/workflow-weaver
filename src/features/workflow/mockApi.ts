/**
 * Mock API layer.
 *
 * In a real product these would be fetch calls to a backend. We keep them
 * promise-based with a small artificial delay so consumer code (hooks /
 * sandbox panel) is written exactly as it would be against a real API.
 *
 * Endpoints simulated:
 *   GET  /automations        -> AutomationDefinition[]
 *   POST /simulate           -> SimulationResult
 */
import type {
  AutomationDefinition,
  SimulationResult,
  SimulationStep,
  WorkflowEdge,
  WorkflowNode,
} from "./types";

const AUTOMATIONS: AutomationDefinition[] = [
  { id: "send_email", label: "Send Email", params: ["to", "subject", "body"] },
  {
    id: "generate_doc",
    label: "Generate Document",
    params: ["template", "recipient"],
  },
  {
    id: "create_account",
    label: "Provision IT Account",
    params: ["employeeId", "department"],
  },
  {
    id: "post_slack",
    label: "Post to Slack",
    params: ["channel", "message"],
  },
  {
    id: "schedule_meeting",
    label: "Schedule Meeting",
    params: ["attendees", "duration"],
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getAutomations(): Promise<AutomationDefinition[]> {
  await wait(180);
  return AUTOMATIONS;
}

interface SimulatePayload {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * Walks the graph from the Start node following edges, producing a
 * step-by-step execution log. This is a simple BFS that respects edge
 * direction and skips already-visited nodes (so accidental loops do not
 * hang the sandbox).
 */
export async function simulateWorkflow(
  payload: SimulatePayload,
): Promise<SimulationResult> {
  await wait(350);

  const startedAt = new Date().toISOString();
  const steps: SimulationStep[] = [];

  const start = payload.nodes.find((n) => n.data.kind === "start");
  if (!start) {
    return {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      steps: [
        {
          nodeId: "_root",
          nodeKind: "start",
          title: "Validation",
          status: "error",
          message: "No Start node found in the workflow.",
          durationMs: 0,
        },
      ],
    };
  }

  const adjacency = new Map<string, string[]>();
  for (const e of payload.edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }
  const byId = new Map(payload.nodes.map((n) => [n.id, n]));

  const visited = new Set<string>();
  const queue: string[] = [start.id];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id);
    if (!node) continue;

    const step = simulateNode(node);
    steps.push(step);

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  const reachedEnd = steps.some((s) => s.nodeKind === "end");
  if (!reachedEnd) {
    steps.push({
      nodeId: "_terminal",
      nodeKind: "end",
      title: "Workflow ended",
      status: "warn",
      message: "Execution stopped without reaching an End node.",
      durationMs: 0,
    });
  }

  return {
    ok: steps.every((s) => s.status !== "error"),
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
  };
}

function simulateNode(node: WorkflowNode): SimulationStep {
  const base = {
    nodeId: node.id,
    nodeKind: node.data.kind,
    durationMs: Math.round(50 + Math.random() * 200),
  } as const;

  switch (node.data.kind) {
    case "start":
      return {
        ...base,
        title: node.data.title || "Start",
        status: "ok",
        message: "Workflow started.",
      };
    case "task":
      return {
        ...base,
        title: node.data.title,
        status: node.data.assignee ? "ok" : "warn",
        message: node.data.assignee
          ? `Task assigned to ${node.data.assignee}${node.data.dueDate ? ` (due ${node.data.dueDate})` : ""}.`
          : "Task created without an assignee.",
      };
    case "approval":
      return {
        ...base,
        title: node.data.title,
        status: "ok",
        message:
          node.data.autoApproveThreshold > 0
            ? `${node.data.approverRole} approval — auto-approve under ${node.data.autoApproveThreshold}.`
            : `${node.data.approverRole} approval requested.`,
      };
    case "automated": {
      const action = AUTOMATIONS.find((a) => a.id === node.data.actionId);
      if (!action) {
        return {
          ...base,
          title: node.data.title,
          status: "error",
          message: "No automation selected.",
        };
      }
      return {
        ...base,
        title: node.data.title,
        status: "ok",
        message: `Ran "${action.label}" with ${Object.keys(node.data.params).length} param(s).`,
      };
    }
    case "end":
      return {
        ...base,
        title: "End",
        status: "ok",
        message: node.data.message || "Workflow complete.",
      };
  }
}
