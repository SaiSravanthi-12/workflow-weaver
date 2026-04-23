import type { NodeKind, WorkflowNodeData } from "./types";

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function defaultDataFor(kind: NodeKind): WorkflowNodeData {
  switch (kind) {
    case "start":
      return { kind: "start", title: "Start", metadata: [] };
    case "task":
      return {
        kind: "task",
        title: "New Task",
        description: "",
        assignee: "",
        dueDate: "",
        customFields: [],
      };
    case "approval":
      return {
        kind: "approval",
        title: "Approval",
        approverRole: "Manager",
        autoApproveThreshold: 0,
      };
    case "automated":
      return {
        kind: "automated",
        title: "Automated Step",
        actionId: "",
        params: {},
      };
    case "end":
      return { kind: "end", message: "Workflow complete", summary: true };
  }
}

export const NODE_LABELS: Record<NodeKind, string> = {
  start: "Start",
  task: "Task",
  approval: "Approval",
  automated: "Automated",
  end: "End",
};

export const NODE_DESCRIPTIONS: Record<NodeKind, string> = {
  start: "Workflow entry point",
  task: "Human task — collect info, prepare docs",
  approval: "Manager / HR approval gate",
  automated: "System action — email, generate doc",
  end: "Workflow completion",
};
