/**
 * POST /api/simulate
 *
 * Walks the workflow graph from the Start node and emits a step-by-step
 * execution log. Mirrors the previous client-side simulator so the UI is
 * unchanged — but the work now happens server-side, where it would
 * eventually call out to real services.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const NODE_KINDS = ["start", "task", "approval", "automated", "end"] as const;

const SimulatePayload = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .max(500),
  edges: z
    .array(
      z.object({
        source: z.string().min(1).max(200),
        target: z.string().min(1).max(200),
      }),
    )
    .max(2000),
});

const AUTOMATION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  generate_doc: "Generate Document",
  create_account: "Provision IT Account",
  post_slack: "Post to Slack",
  schedule_meeting: "Schedule Meeting",
};

interface SimNode {
  id: string;
  data: Record<string, unknown>;
}

type Status = "ok" | "warn" | "error";
interface Step {
  nodeId: string;
  nodeKind: (typeof NODE_KINDS)[number];
  title: string;
  status: Status;
  message: string;
  durationMs: number;
}

function simulateNode(node: SimNode): Step {
  const data = node.data as { kind?: (typeof NODE_KINDS)[number] } & Record<
    string,
    unknown
  >;
  const kind = data.kind ?? "task";
  const durationMs = Math.round(50 + Math.random() * 200);
  const base = { nodeId: node.id, nodeKind: kind, durationMs };

  switch (kind) {
    case "start":
      return {
        ...base,
        title: (data.title as string) || "Start",
        status: "ok",
        message: "Workflow started.",
      };
    case "task": {
      const title = (data.title as string) || "Task";
      const assignee = (data.assignee as string) || "";
      const dueDate = (data.dueDate as string) || "";
      return {
        ...base,
        title,
        status: assignee ? "ok" : "warn",
        message: assignee
          ? `Task assigned to ${assignee}${dueDate ? ` (due ${dueDate})` : ""}.`
          : "Task created without an assignee.",
      };
    }
    case "approval": {
      const title = (data.title as string) || "Approval";
      const role = (data.approverRole as string) || "Manager";
      const threshold = Number(data.autoApproveThreshold ?? 0);
      return {
        ...base,
        title,
        status: "ok",
        message:
          threshold > 0
            ? `${role} approval — auto-approve under ${threshold}.`
            : `${role} approval requested.`,
      };
    }
    case "automated": {
      const title = (data.title as string) || "Automated step";
      const actionId = (data.actionId as string) || "";
      const params = (data.params as Record<string, string>) || {};
      if (!actionId) {
        return {
          ...base,
          title,
          status: "error",
          message: "No automation selected.",
        };
      }
      const label = AUTOMATION_LABELS[actionId] ?? actionId;
      return {
        ...base,
        title,
        status: "ok",
        message: `Ran "${label}" with ${Object.keys(params).length} param(s).`,
      };
    }
    case "end":
      return {
        ...base,
        title: "End",
        status: "ok",
        message: (data.message as string) || "Workflow complete.",
      };
    default:
      return {
        ...base,
        nodeKind: "task",
        title: "Unknown",
        status: "warn",
        message: "Unknown node kind.",
      };
  }
}

function runSimulation(nodes: SimNode[], edges: { source: string; target: string }[]) {
  const startedAt = new Date().toISOString();
  const steps: Step[] = [];

  const start = nodes.find(
    (n) => (n.data as { kind?: string }).kind === "start",
  );
  if (!start) {
    return {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      steps: [
        {
          nodeId: "_root",
          nodeKind: "start" as const,
          title: "Validation",
          status: "error" as const,
          message: "No Start node found in the workflow.",
          durationMs: 0,
        },
      ],
    };
  }

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const visited = new Set<string>();
  const queue: string[] = [start.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) continue;
    steps.push(simulateNode(node));
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

export const Route = createFileRoute("/api/simulate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS_HEADERS },
            },
          );
        }
        const parsed = SimulatePayload.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({
              error: "Invalid payload",
              issues: parsed.error.flatten(),
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS_HEADERS },
            },
          );
        }
        const result = runSimulation(parsed.data.nodes, parsed.data.edges);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      },
    },
  },
});
