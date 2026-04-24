/**
 * Connection / edge rules.
 *
 * Centralises the "can A connect to B?" logic so the canvas can:
 *  - block invalid `onConnect` attempts up-front,
 *  - explain why with a friendly message, and
 *  - offer one-click fixes (e.g. "swap source ↔ target", "insert Start").
 */
import type { Connection } from "@xyflow/react";
import type { NodeKind, WorkflowEdge, WorkflowNode } from "./types";

export interface ConnectionCheck {
  ok: boolean;
  reason?: string;
  /** Optional one-click suggestion. */
  fix?: ConnectionFix;
}

export type ConnectionFix =
  | { kind: "swap"; label: string; connection: Connection }
  | { kind: "skip"; label: string }
  | { kind: "addStart"; label: string };

function getKind(nodes: WorkflowNode[], id: string | null | undefined): NodeKind | null {
  if (!id) return null;
  const n = nodes.find((x) => x.id === id);
  return (n?.data.kind as NodeKind | undefined) ?? null;
}

export function checkConnection(
  conn: Connection,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): ConnectionCheck {
  if (!conn.source || !conn.target) {
    return { ok: false, reason: "Missing source or target." };
  }
  if (conn.source === conn.target) {
    return { ok: false, reason: "A node cannot connect to itself." };
  }

  const srcKind = getKind(nodes, conn.source);
  const tgtKind = getKind(nodes, conn.target);
  if (!srcKind || !tgtKind) {
    return { ok: false, reason: "Unknown node." };
  }

  // End nodes can't have outgoing edges.
  if (srcKind === "end") {
    return {
      ok: false,
      reason: "End is a terminal node — it can't start a new connection.",
      fix: {
        kind: "swap",
        label: "Swap direction (use End as the target instead)",
        connection: { ...conn, source: conn.target, target: conn.source },
      },
    };
  }
  // Start nodes can't have incoming edges.
  if (tgtKind === "start") {
    return {
      ok: false,
      reason: "Start has to come first — it can't receive incoming connections.",
      fix: {
        kind: "swap",
        label: "Swap direction (use Start as the source)",
        connection: { ...conn, source: conn.target, target: conn.source },
      },
    };
  }

  // Disallow duplicate edges between the same pair.
  if (edges.some((e) => e.source === conn.source && e.target === conn.target)) {
    return { ok: false, reason: "These nodes are already connected." };
  }

  // Suggest a Start when the source is a non-Start node and no Start exists yet.
  const hasStart = nodes.some((n) => n.data.kind === "start");
  if (!hasStart && srcKind !== "start") {
    return {
      ok: true,
      reason: "Workflow has no Start node yet — you'll see a validation warning.",
      fix: { kind: "addStart", label: "Add a Start node automatically" },
    };
  }

  return { ok: true };
}
