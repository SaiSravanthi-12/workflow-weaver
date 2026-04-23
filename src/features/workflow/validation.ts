import type { ValidationIssue, WorkflowEdge, WorkflowNode } from "./types";

/**
 * Static validation of the workflow graph. Surfaces issues to the sandbox
 * panel and (in future) to per-node badges.
 */
export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const starts = nodes.filter((n) => n.data.kind === "start");
  const ends = nodes.filter((n) => n.data.kind === "end");

  if (starts.length === 0) issues.push({ level: "error", message: "Workflow needs a Start node." });
  if (starts.length > 1)
    issues.push({
      level: "error",
      message: `Only one Start node allowed (found ${starts.length}).`,
    });
  if (ends.length === 0)
    issues.push({
      level: "warning",
      message: "Workflow has no End node.",
    });

  // Orphan check
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  for (const n of nodes) {
    if (nodes.length > 1 && !connected.has(n.id)) {
      issues.push({
        level: "warning",
        nodeId: n.id,
        message: `"${getTitle(n)}" is not connected to anything.`,
      });
    }
  }

  // Cycle detection (DFS)
  if (hasCycle(nodes, edges)) {
    issues.push({
      level: "error",
      message: "Workflow contains a cycle — remove the looping edge.",
    });
  }

  // Automated nodes without an action
  for (const n of nodes) {
    if (n.data.kind === "automated" && !n.data.actionId) {
      issues.push({
        level: "warning",
        nodeId: n.id,
        message: `"${n.data.title}" has no automation selected.`,
      });
    }
  }

  return issues;
}

function getTitle(n: WorkflowNode): string {
  if (n.data.kind === "end") return "End";
  return (n.data as { title?: string }).title ?? n.id;
}

function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);

  function dfs(u: string): boolean {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) return true;
      if (c === WHITE && dfs(v)) return true;
    }
    color.set(u, BLACK);
    return false;
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE && dfs(n.id)) return true;
  }
  return false;
}
