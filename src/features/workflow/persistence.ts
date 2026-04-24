/**
 * localStorage persistence layer for the active (in-progress) workflow.
 * Saved workflows in the user library go through `library.ts` (also localStorage).
 */
import type { CommentNote, WorkflowEdge, WorkflowNode } from "./types";

const KEY = "hr-workflow-designer:draft:v2";
const LEGACY_KEY = "hr-workflow-designer:draft:v1";

export interface PersistedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments: Record<string, CommentNote[]>;
  savedAt: string;
}

interface LegacyPersistedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments: Record<string, string>;
  savedAt: string;
}

function migrateLegacy(legacy: LegacyPersistedWorkflow): PersistedWorkflow {
  const comments: Record<string, CommentNote[]> = {};
  for (const [nodeId, body] of Object.entries(legacy.comments ?? {})) {
    if (typeof body === "string" && body.trim()) {
      comments[nodeId] = [
        {
          id: `c_${nodeId}_legacy`,
          author: "You",
          body,
          createdAt: legacy.savedAt ?? new Date().toISOString(),
        },
      ];
    }
  }
  return {
    nodes: legacy.nodes,
    edges: legacy.edges,
    comments,
    savedAt: legacy.savedAt ?? new Date().toISOString(),
  };
}

export function loadDraft(): PersistedWorkflow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedWorkflow;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
      return parsed;
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as LegacyPersistedWorkflow;
      if (Array.isArray(legacy.nodes) && Array.isArray(legacy.edges)) {
        return migrateLegacy(legacy);
      }
    }
    return null;
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
    /* ignore */
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
