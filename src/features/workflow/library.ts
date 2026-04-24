/**
 * Local workflow library — backend persistence has been removed. Saved
 * workflows now live in localStorage so the prototype works without auth.
 *
 * The exported API is kept identical to the previous Supabase-backed module
 * so callers (designer, /library page, /w/$id route) don't change.
 */
import type { WorkflowEdge, WorkflowNode } from "./types";
import type { CommentNote } from "./types";

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments?: Record<string, CommentNote[]>;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string | null;
  graph: WorkflowGraph;
  created_at: string;
  updated_at: string;
}

const KEY = "hr-workflow-designer:library:v1";

function read(): SavedWorkflow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedWorkflow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: SavedWorkflow[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / disabled */
  }
}

function newId(): string {
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listWorkflows(): Promise<SavedWorkflow[]> {
  return [...read()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getWorkflow(id: string): Promise<SavedWorkflow> {
  const found = read().find((w) => w.id === id);
  if (!found) throw new Error("Workflow not found");
  return found;
}

export async function createWorkflow(input: {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments?: Record<string, CommentNote[]>;
}): Promise<SavedWorkflow> {
  const now = new Date().toISOString();
  const wf: SavedWorkflow = {
    id: newId(),
    name: input.name,
    description: input.description ?? null,
    graph: {
      nodes: input.nodes,
      edges: input.edges,
      comments: input.comments ?? {},
    },
    created_at: now,
    updated_at: now,
  };
  write([wf, ...read()]);
  return wf;
}

export async function updateWorkflow(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    comments?: Record<string, CommentNote[]>;
  },
): Promise<SavedWorkflow> {
  const items = read();
  const idx = items.findIndex((w) => w.id === id);
  if (idx < 0) throw new Error("Workflow not found");
  const cur = items[idx];
  const next: SavedWorkflow = {
    ...cur,
    name: patch.name ?? cur.name,
    description: patch.description !== undefined ? patch.description : cur.description,
    graph: patch.nodes && patch.edges
      ? {
          nodes: patch.nodes,
          edges: patch.edges,
          comments: patch.comments ?? cur.graph.comments ?? {},
        }
      : cur.graph,
    updated_at: new Date().toISOString(),
  };
  items[idx] = next;
  write(items);
  return next;
}

export async function deleteWorkflow(id: string): Promise<void> {
  write(read().filter((w) => w.id !== id));
}
