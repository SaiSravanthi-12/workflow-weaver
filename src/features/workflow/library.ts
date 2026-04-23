/**
 * Workflow library API. Strongly typed CRUD over the `workflows` table.
 * RLS guarantees users only see their own rows.
 */
import { supabase } from "@/integrations/supabase/client";
import type { WorkflowEdge, WorkflowNode } from "./types";

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments?: Record<string, string>;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string | null;
  graph: WorkflowGraph;
  created_at: string;
  updated_at: string;
}

interface DbRow {
  id: string;
  name: string;
  description: string | null;
  graph: unknown;
  created_at: string;
  updated_at: string;
}

function toSaved(row: DbRow): SavedWorkflow {
  const graph = (row.graph ?? { nodes: [], edges: [], comments: {} }) as WorkflowGraph;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    graph: {
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
      comments: graph.comments ?? {},
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listWorkflows(): Promise<SavedWorkflow[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select("id,name,description,graph,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as DbRow[]).map(toSaved);
}

export async function getWorkflow(id: string): Promise<SavedWorkflow> {
  const { data, error } = await supabase
    .from("workflows")
    .select("id,name,description,graph,created_at,updated_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return toSaved(data as unknown as DbRow);
}

export async function createWorkflow(input: {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments?: Record<string, string>;
}): Promise<SavedWorkflow> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");
  const payload = {
    user_id: userData.user.id,
    name: input.name,
    description: input.description ?? null,
    graph: {
      nodes: input.nodes,
      edges: input.edges,
      comments: input.comments ?? {},
    } as unknown,
  };
  const { data, error } = await supabase
    .from("workflows")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return toSaved(data as unknown as DbRow);
}

export async function updateWorkflow(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    comments?: Record<string, string>;
  },
): Promise<SavedWorkflow> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.nodes && patch.edges) {
    update.graph = {
      nodes: patch.nodes,
      edges: patch.edges,
      comments: patch.comments ?? {},
    };
  }
  const { data, error } = await supabase
    .from("workflows")
    .update(update as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toSaved(data as unknown as DbRow);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  if (error) throw error;
}
