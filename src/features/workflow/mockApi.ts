/**
 * Workflow API client.
 *
 * Talks to the TanStack server routes:
 *   GET  /api/automations  -> { automations: AutomationDefinition[] }
 *   POST /api/simulate     -> SimulationResult
 *
 * The file name is preserved for compatibility with existing imports;
 * functionally this is now a thin HTTP client, not a mock.
 */
import type { AutomationDefinition, SimulationResult, WorkflowEdge, WorkflowNode } from "./types";

export async function getAutomations(): Promise<AutomationDefinition[]> {
  const res = await fetch("/api/automations", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to load automations (${res.status})`);
  }
  const json = (await res.json()) as { automations: AutomationDefinition[] };
  return json.automations ?? [];
}

interface SimulatePayload {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export async function simulateWorkflow(payload: SimulatePayload): Promise<SimulationResult> {
  // Trim to the shape the API needs — keeps the request small and avoids
  // sending React Flow internal fields like `position`, `selected`, etc.
  const body = {
    nodes: payload.nodes.map((n) => ({ id: n.id, data: n.data })),
    edges: payload.edges.map((e) => ({ source: e.source, target: e.target })),
  };
  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Simulation failed (${res.status}) ${text}`);
  }
  return (await res.json()) as SimulationResult;
}
