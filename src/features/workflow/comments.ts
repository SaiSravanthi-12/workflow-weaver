/**
 * Helpers for the multi-note comment system. Includes a backward-compat
 * migration that turns the old `Record<nodeId, string>` shape into
 * `Record<nodeId, CommentNote[]>`.
 */
import { uid } from "./defaults";
import type { CommentMap, CommentNote } from "./types";

export function migrateComments(input: unknown): CommentMap {
  if (!input || typeof input !== "object") return {};
  const out: CommentMap = {};
  for (const [nodeId, value] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const notes = value
        .filter((n): n is Partial<CommentNote> => !!n && typeof n === "object")
        .map((n) => ({
          id: typeof n.id === "string" ? n.id : uid("note"),
          author: typeof n.author === "string" ? n.author : "Anonymous",
          text: typeof n.text === "string" ? n.text : "",
          createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
        }))
        .filter((n) => n.text.trim().length > 0);
      if (notes.length) out[nodeId] = notes;
    } else if (typeof value === "string" && value.trim()) {
      // Legacy: single string per node.
      out[nodeId] = [
        {
          id: uid("note"),
          author: "Imported",
          text: value,
          createdAt: new Date().toISOString(),
        },
      ];
    }
  }
  return out;
}

export function addNote(map: CommentMap, nodeId: string, author: string, text: string): CommentMap {
  const trimmed = text.trim();
  if (!trimmed) return map;
  const existing = map[nodeId] ?? [];
  const note: CommentNote = {
    id: uid("note"),
    author: author || "Anonymous",
    text: trimmed,
    createdAt: new Date().toISOString(),
  };
  return { ...map, [nodeId]: [...existing, note] };
}

export function updateNote(
  map: CommentMap,
  nodeId: string,
  noteId: string,
  text: string,
): CommentMap {
  const existing = map[nodeId];
  if (!existing) return map;
  return {
    ...map,
    [nodeId]: existing.map((n) => (n.id === noteId ? { ...n, text } : n)),
  };
}

export function removeNote(map: CommentMap, nodeId: string, noteId: string): CommentMap {
  const existing = map[nodeId];
  if (!existing) return map;
  const next = existing.filter((n) => n.id !== noteId);
  const out = { ...map };
  if (next.length === 0) delete out[nodeId];
  else out[nodeId] = next;
  return out;
}

export function noteSummary(notes: CommentNote[] | undefined): string {
  if (!notes || notes.length === 0) return "";
  const last = notes[notes.length - 1];
  return `${last.author}: ${last.text}`;
}
