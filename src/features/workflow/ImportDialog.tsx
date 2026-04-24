/**
 * JSON import dialog.
 *
 * The parser is intentionally forgiving: malformed nodes/edges/comments
 * are *skipped* rather than aborting the entire import, and every dropped
 * item is surfaced as an issue inside the dialog so the user knows what
 * was salvaged.
 */
import { useMemo, useState } from "react";
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
import { Upload, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentNote, NodeKind, WorkflowEdge, WorkflowNode } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    comments: Record<string, CommentNote[]>;
  }) => void;
}

interface Issue {
  level: "error" | "warning" | "info";
  message: string;
}

interface ParseResult {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments: Record<string, CommentNote[]>;
  issues: Issue[];
  fatal: boolean;
}

const VALID_KINDS: NodeKind[] = ["start", "task", "approval", "automated", "end"];

function isPlain(o: unknown): o is Record<string, unknown> {
  return !!o && typeof o === "object" && !Array.isArray(o);
}

function parse(text: string): ParseResult {
  const issues: Issue[] = [];
  const empty: ParseResult = {
    nodes: [],
    edges: [],
    comments: {},
    issues,
    fatal: false,
  };

  if (!text.trim()) {
    return { ...empty, fatal: true, issues: [{ level: "error", message: "Paste some JSON first." }] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    return { ...empty, fatal: true, issues: [{ level: "error", message: `JSON parse error — ${msg}` }] };
  }

  if (!isPlain(parsed)) {
    return {
      ...empty,
      fatal: true,
      issues: [{ level: "error", message: "Top-level value must be an object with `nodes`/`edges`/`comments`." }],
    };
  }

  const root = parsed;
  const nodes: WorkflowNode[] = [];
  const validIds = new Set<string>();

  // ---- nodes ----
  const rawNodes = root.nodes;
  if (rawNodes !== undefined && !Array.isArray(rawNodes)) {
    issues.push({ level: "warning", message: "`nodes` is not an array — skipping all nodes." });
  } else if (Array.isArray(rawNodes)) {
    rawNodes.forEach((raw, idx) => {
      if (!isPlain(raw)) {
        issues.push({ level: "warning", message: `Node #${idx + 1}: not an object, skipped.` });
        return;
      }
      const data = isPlain(raw.data) ? raw.data : null;
      const kind = data && typeof data.kind === "string" ? (data.kind as string) : null;
      if (!kind || !VALID_KINDS.includes(kind as NodeKind)) {
        issues.push({
          level: "warning",
          message: `Node #${idx + 1}: missing or invalid \`data.kind\` (got ${JSON.stringify(kind)}), skipped.`,
        });
        return;
      }
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `imported_${idx}`;
      if (validIds.has(id)) {
        issues.push({ level: "warning", message: `Node #${idx + 1}: duplicate id \`${id}\`, skipped.` });
        return;
      }
      const pos = isPlain(raw.position)
        ? {
            x: Number((raw.position as { x?: unknown }).x) || 0,
            y: Number((raw.position as { y?: unknown }).y) || 0,
          }
        : { x: 80 + idx * 40, y: 80 + idx * 60 };
      const type = (typeof raw.type === "string" ? raw.type : kind) as NodeKind;
      validIds.add(id);
      nodes.push({ id, type, position: pos, data: data as WorkflowNode["data"] });
    });
  }

  // ---- edges ----
  const rawEdges = root.edges;
  const edges: WorkflowEdge[] = [];
  if (rawEdges !== undefined && !Array.isArray(rawEdges)) {
    issues.push({ level: "warning", message: "`edges` is not an array — skipping all edges." });
  } else if (Array.isArray(rawEdges)) {
    rawEdges.forEach((raw, idx) => {
      if (!isPlain(raw)) {
        issues.push({ level: "warning", message: `Edge #${idx + 1}: not an object, skipped.` });
        return;
      }
      const source = typeof raw.source === "string" ? raw.source : null;
      const target = typeof raw.target === "string" ? raw.target : null;
      if (!source || !target) {
        issues.push({ level: "warning", message: `Edge #${idx + 1}: missing source/target, skipped.` });
        return;
      }
      if (!validIds.has(source) || !validIds.has(target)) {
        issues.push({
          level: "warning",
          message: `Edge #${idx + 1}: references unknown node (${!validIds.has(source) ? source : target}), skipped.`,
        });
        return;
      }
      edges.push({
        id: typeof raw.id === "string" ? raw.id : `e_imported_${idx}`,
        source,
        target,
        animated: true,
      });
    });
  }

  // ---- comments ----
  const comments: Record<string, CommentNote[]> = {};
  const rawComments = root.comments;
  if (rawComments !== undefined && !isPlain(rawComments)) {
    issues.push({ level: "warning", message: "`comments` is not an object — skipping comments." });
  } else if (isPlain(rawComments)) {
    for (const [nodeId, val] of Object.entries(rawComments)) {
      if (!validIds.has(nodeId)) {
        issues.push({
          level: "warning",
          message: `Comments for unknown node \`${nodeId}\` were skipped.`,
        });
        continue;
      }
      if (Array.isArray(val)) {
        const list = val
          .map((n, i): CommentNote | null => {
            if (!isPlain(n)) return null;
            const body = typeof n.body === "string" ? n.body : "";
            if (!body.trim()) return null;
            return {
              id: typeof n.id === "string" ? n.id : `c_imp_${nodeId}_${i}`,
              author: typeof n.author === "string" ? n.author : "Imported",
              body,
              createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
            };
          })
          .filter((n): n is CommentNote => n !== null);
        if (list.length) comments[nodeId] = list;
      } else if (typeof val === "string" && val.trim()) {
        // Legacy single-string comment.
        comments[nodeId] = [
          {
            id: `c_imp_${nodeId}_legacy`,
            author: "Imported",
            body: val,
            createdAt: new Date().toISOString(),
          },
        ];
      }
    }
  }

  if (nodes.length > 0) {
    issues.unshift({
      level: "info",
      message: `Salvaged ${nodes.length} node(s), ${edges.length} edge(s), ${
        Object.values(comments).reduce((s, l) => s + l.length, 0)
      } comment(s).`,
    });
  }

  return { nodes, edges, comments, issues, fatal: nodes.length === 0 };
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
  const [attempted, setAttempted] = useState(false);

  const result = useMemo<ParseResult | null>(() => {
    if (!attempted) return null;
    return parse(text);
  }, [text, attempted]);

  const handlePreview = () => setAttempted(true);

  const handleImport = () => {
    const r = result ?? parse(text);
    if (r.fatal || r.nodes.length === 0) {
      setAttempted(true);
      return;
    }
    onImport({ nodes: r.nodes, edges: r.edges, comments: r.comments });
    onOpenChange(false);
    setText("");
    setAttempted(false);
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setAttempted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import workflow JSON</DialogTitle>
          <DialogDescription>
            Paste a workflow snapshot. Malformed nodes/edges are skipped — the issue list shows
            exactly what was salvaged or dropped.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAttempted(false);
          }}
          placeholder={SAMPLE}
          className="font-mono text-xs"
        />

        {result && (
          <div className="max-h-44 space-y-1.5 overflow-auto rounded-md border border-border bg-secondary/30 p-2">
            {result.issues.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">No issues — looks clean.</p>
            ) : (
              result.issues.map((i, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 rounded px-2 py-1.5 text-xs",
                    i.level === "error" && "bg-destructive/10 text-destructive",
                    i.level === "warning" &&
                      "bg-[var(--node-approval)]/10 text-[var(--node-approval)]",
                    i.level === "info" && "bg-[var(--node-start)]/10 text-[var(--node-start)]",
                  )}
                >
                  {i.level === "error" ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : i.level === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{i.message}</span>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handlePreview} disabled={!text.trim()}>
            Validate
          </Button>
          <Button
            onClick={handleImport}
            disabled={!text.trim() || (!!result && result.fatal)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import {result && !result.fatal ? `(${result.nodes.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
