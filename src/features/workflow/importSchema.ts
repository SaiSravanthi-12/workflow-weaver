/**
 * Lenient Zod schema for the JSON import dialog. We only enforce the shape
 * we actually need (id/type/position/data + source/target). React Flow
 * tolerates extra fields, so anything unknown is passed through.
 */
import { z } from "zod";
import { migrateComments } from "./comments";
import type { CommentMap, WorkflowEdge, WorkflowNode } from "./types";

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const nodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().optional(),
    position: positionSchema,
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const edgeSchema = z
  .object({
    id: z.string().optional(),
    source: z.string().min(1),
    target: z.string().min(1),
  })
  .passthrough();

export const importSchema = z.object({
  nodes: z.array(nodeSchema).max(500),
  edges: z.array(edgeSchema).max(2000).default([]),
  comments: z.unknown().optional(),
});

export interface ImportResult {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments: CommentMap;
}

export function parseImport(raw: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON: ${(err as Error).message}`);
  }
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      first ? `${first.path.join(".") || "root"}: ${first.message}` : "Invalid workflow shape",
    );
  }
  // Ensure every edge has an id.
  const edges = parsed.data.edges.map((e, idx) => ({
    ...e,
    id: e.id ?? `e_${idx}_${e.source}_${e.target}`,
  })) as WorkflowEdge[];
  return {
    nodes: parsed.data.nodes as unknown as WorkflowNode[],
    edges,
    comments: migrateComments(parsed.data.comments),
  };
}
