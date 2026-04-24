/**
 * JSON import dialog — paste a workflow snapshot (nodes/edges/comments) to
 * replace the current canvas. Validates loosely so partial exports work.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle } from "lucide-react";
import type { CommentNote, WorkflowEdge, WorkflowNode } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    comments: Record<string, CommentNote[]>;
  }) => void;
}

interface RawNode {
  id?: unknown;
  type?: unknown;
  position?: unknown;
  data?: unknown;
}
interface RawEdge {
  id?: unknown;
  source?: unknown;
  target?: unknown;
}

function coerceNodes(input: unknown): WorkflowNode[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw, idx): WorkflowNode | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as RawNode;
      const id = typeof r.id === "string" ? r.id : `imported_${idx}`;
      const data = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
      const kind = data && typeof data.kind === "string" ? (data.kind as string) : null;
      if (!kind) return null;
      const position =
        r.position && typeof r.position === "object"
          ? {
              x: Number((r.position as { x?: unknown }).x) || 0,
              y: Number((r.position as { y?: unknown }).y) || 0,
            }
          : { x: 0, y: 0 };
      const type = typeof r.type === "string" ? r.type : kind;
      return { id, type, position, data: data as WorkflowNode["data"] };
    })
    .filter((n): n is WorkflowNode => n !== null);
}

function coerceEdges(input: unknown): WorkflowEdge[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw, idx): WorkflowEdge | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as RawEdge;
      if (typeof r.source !== "string" || typeof r.target !== "string") return null;
      return {
        id: typeof r.id === "string" ? r.id : `e_imported_${idx}`,
        source: r.source,
        target: r.target,
        animated: true,
      };
    })
    .filter((e): e is WorkflowEdge => e !== null);
}

function coerceComments(input: unknown): Record<string, CommentNote[]> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, CommentNote[]> = {};
  for (const [nodeId, val] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      out[nodeId] = val
        .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
        .map((n, i): CommentNote => ({
          id: typeof n.id === "string" ? n.id : `c_imp_${nodeId}_${i}`,
          author: typeof n.author === "string" ? n.author : "Imported",
          body: typeof n.body === "string" ? n.body : "",
          createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
        }))
        .filter((n) => n.body.length > 0);
    } else if (typeof val === "string" && val.trim()) {
      // Legacy single-string format.
      out[nodeId] = [
        {
          id: `c_imp_${nodeId}_legacy`,
          author: "Imported",
          body: val,
          createdAt: new Date().toISOString(),
        },
      ];
    }
  }
  return out;
}

const SAMPLE = `{
  "nodes": [
    { "id": "start_1", "type": "start", "position": {"x": 280, "y": 40},
      "data": {"kind": "start", "title": "Kickoff", "metadata": []} }
  ],
  "edges": [],
  "comments": {}
}`;

export function ImportDialog({ open, onOpenChange, onImport }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      setError("Expected a JSON object with `nodes` and `edges`.");
      return;
    }
    const root = parsed as Record<string, unknown>;
    const nodes = coerceNodes(root.nodes);
    if (nodes.length === 0) {
      setError("No valid nodes found. Each node needs `id` and `data.kind`.");
      return;
    }
    const edges = coerceEdges(root.edges);
    const comments = coerceComments(root.comments);
    onImport({ nodes, edges, comments });
    onOpenChange(false);
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import workflow JSON</DialogTitle>
          <DialogDescription>
            Paste a workflow snapshot (nodes, edges, and optional comments) to replace the current
            canvas.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={SAMPLE}
          className="font-mono text-xs"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!text.trim()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
