/**
 * localStorage persistence layer for the active (in-progress) workflow.
 * Saved workflows in the user library go through Supabase, not this.
 */
import { migrateComments } from "./comments";
import type { CommentMap, WorkflowEdge, WorkflowNode } from "./types";

const KEY = "hr-workflow-designer:draft:v2";
const LEGACY_KEY = "hr-workflow-designer:draft:v1";

export interface PersistedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments: CommentMap;
  savedAt: string;
}

export function loadDraft(): PersistedWorkflow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkflow>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return {
      nodes: parsed.nodes,
      edges: parsed.edges,
      comments: migrateComments(parsed.comments),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(payload: Omit<PersistedWorkflow, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const data: PersistedWorkflow = { ...payload, savedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full / disabled — silently ignore */
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
