/**
 * Workflow domain types.
 *
 * Each node in the React Flow graph has a discriminated union of `data`,
 * keyed by `kind`. This keeps node-specific configuration strongly typed
 * while sharing the same Node container.
 */
import type { Node, Edge } from "@xyflow/react";

export type NodeKind =
  | "start"
  | "task"
  | "approval"
  | "automated"
  | "end";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
}

/** Per-node author note. Stored alongside data so it serializes naturally. */
export interface WithComment {
  comment?: string;
}

export interface StartNodeData {
  kind: "start";
  title: string;
  metadata: KeyValue[];
  [key: string]: unknown;
}

export interface TaskNodeData {
  kind: "task";
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  customFields: KeyValue[];
  [key: string]: unknown;
}

export interface ApprovalNodeData {
  kind: "approval";
  title: string;
  approverRole: string;
  autoApproveThreshold: number;
  [key: string]: unknown;
}

export interface AutomatedNodeData {
  kind: "automated";
  title: string;
  actionId: string;
  params: Record<string, string>;
  [key: string]: unknown;
}

export interface EndNodeData {
  kind: "end";
  message: string;
  summary: boolean;
  [key: string]: unknown;
}

export type WorkflowNodeData =
  | StartNodeData
  | TaskNodeData
  | ApprovalNodeData
  | AutomatedNodeData
  | EndNodeData;

export type WorkflowNode = Node<WorkflowNodeData, NodeKind>;
export type WorkflowEdge = Edge;

export interface AutomationDefinition {
  id: string;
  label: string;
  params: string[];
}

export interface SimulationStep {
  nodeId: string;
  nodeKind: NodeKind;
  title: string;
  status: "ok" | "warn" | "error";
  message: string;
  durationMs: number;
}

export interface SimulationResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  steps: SimulationStep[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  nodeId?: string;
}
