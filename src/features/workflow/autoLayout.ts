/**
 * Layered top-to-bottom auto-layout.
 *
 * Roughly: longest-path layering (Coffman-Graham-lite) → barycentric
 * crossing reduction within each layer → grid placement. Pure JS, no deps.
 *
 * Good enough to make any user-built graph readable in one click; not
 * intended to compete with dagre/elk on very large graphs.
 */
import type { WorkflowEdge, WorkflowNode } from "./types";

interface LayoutOptions {
  hGap?: number;
  vGap?: number;
  startY?: number;
  startX?: number;
  nodeWidth?: number;
}

export function autoLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  opts: LayoutOptions = {},
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  const hGap = opts.hGap ?? 60;
  const vGap = opts.vGap ?? 120;
  const startY = opts.startY ?? 40;
  const startX = opts.startX ?? 80;
  const nodeWidth = opts.nodeWidth ?? 240;

  // Build adjacency.
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of edges) {
    if (outgoing.has(e.source) && incoming.has(e.target)) {
      outgoing.get(e.source)!.push(e.target);
      incoming.get(e.target)!.push(e.source);
    }
  }

  // Layer assignment via longest path from any "root" (no incoming edge).
  // For nodes inside a cycle (rare — validation flags it), fall back to 0.
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  function depth(id: string): number {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const d = parents.length === 0 ? 0 : Math.max(...parents.map((p) => depth(p) + 1));
    visiting.delete(id);
    layer.set(id, d);
    return d;
  }
  for (const n of nodes) depth(n.id);

  // Bucket by layer.
  const layers: string[][] = [];
  for (const n of nodes) {
    const d = layer.get(n.id) ?? 0;
    if (!layers[d]) layers[d] = [];
    layers[d].push(n.id);
  }

  // Crossing reduction: for each layer past the first, sort by mean parent index.
  for (let i = 1; i < layers.length; i += 1) {
    const prev = layers[i - 1];
    const indexOf = new Map(prev.map((id, idx) => [id, idx]));
    layers[i].sort((a, b) => barycenter(a) - barycenter(b));

    function barycenter(id: string): number {
      const ps = (incoming.get(id) ?? [])
        .map((p) => indexOf.get(p))
        .filter((v): v is number => v !== undefined);
      if (ps.length === 0) return Number.POSITIVE_INFINITY;
      return ps.reduce((s, v) => s + v, 0) / ps.length;
    }
  }

  // Place: each layer is a row; nodes are spaced evenly horizontally and
  // centered around the widest layer.
  const widest = Math.max(...layers.map((l) => l.length), 1);
  const totalWidth = widest * (nodeWidth + hGap) - hGap;

  const positions = new Map<string, { x: number; y: number }>();
  layers.forEach((row, rowIdx) => {
    const rowWidth = row.length * (nodeWidth + hGap) - hGap;
    const offset = startX + (totalWidth - rowWidth) / 2;
    row.forEach((id, colIdx) => {
      positions.set(id, {
        x: offset + colIdx * (nodeWidth + hGap),
        y: startY + rowIdx * vGap,
      });
    });
  });

  return nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, position: p } : n;
  });
}
