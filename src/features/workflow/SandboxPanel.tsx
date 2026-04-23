import { useState } from "react";
import {
  Play,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  SimulationResult,
  ValidationIssue,
  WorkflowEdge,
  WorkflowNode,
} from "./types";
import { simulateWorkflow } from "./mockApi";
import { validateWorkflow } from "./validation";

interface SandboxPanelProps {
  open: boolean;
  onClose: () => void;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export function SandboxPanel({
  open,
  onClose,
  nodes,
  edges,
}: SandboxPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  if (!open) return null;

  const run = async () => {
    setRunning(true);
    setResult(null);
    const found = validateWorkflow(nodes, edges);
    setIssues(found);
    if (found.some((i) => i.level === "error")) {
      setRunning(false);
      return;
    }
    const res = await simulateWorkflow({ nodes, edges });
    setResult(res);
    setRunning(false);
  };

  const exportJson = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[420px] flex-col border-l border-border bg-card shadow-[var(--shadow-panel)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Workflow sandbox
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Simulate execution with mock data.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={exportJson}
            title="Export JSON"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-b border-border p-4">
        <Button onClick={run} disabled={running} className="w-full">
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Run simulation
            </>
          )}
        </Button>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Nodes" value={nodes.length} />
          <Stat label="Edges" value={edges.length} />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {issues.length > 0 && (
          <section>
            <SectionTitle>Validation</SectionTitle>
            <ul className="space-y-1.5">
              {issues.map((i, idx) => (
                <li
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
                    i.level === "error"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-[var(--node-approval)]/30 bg-[var(--node-approval)]/5 text-[var(--node-approval)]",
                  )}
                >
                  {i.level === "error" ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result && (
          <section>
            <SectionTitle>
              Execution log
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  result.ok
                    ? "bg-[var(--node-start)]/15 text-[var(--node-start)]"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {result.ok ? "success" : "failed"}
              </span>
            </SectionTitle>
            <ol className="relative ml-2 space-y-3 border-l border-border pl-4">
              {result.steps.map((s, i) => (
                <li key={`${s.nodeId}-${i}`} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[21px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-card",
                      s.status === "ok"
                        ? "bg-[var(--node-start)]"
                        : s.status === "warn"
                          ? "bg-[var(--node-approval)]"
                          : "bg-destructive",
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {s.title}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.nodeKind}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {s.durationMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.message}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!result && issues.length === 0 && !running && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Click <span className="font-medium">Run simulation</span> to test
              your workflow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}
