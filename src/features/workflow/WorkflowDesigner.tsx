import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type OnConnect,
  type ReactFlowInstance,
  type IsValidConnection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Link } from "@tanstack/react-router";
import {
  Play,
  Workflow,
  Sparkles,
  Save,
  FolderOpen,
  Command,
  Undo2,
  Redo2,
  LayoutGrid,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { nodeTypes } from "./nodes";
import { NodeSidebar } from "./NodeSidebar";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { SandboxPanel } from "./SandboxPanel";
import { CommandPalette } from "./CommandPalette";
import { ImportDialog } from "./ImportDialog";
import { defaultDataFor, uid } from "./defaults";
import { getAutomations } from "./mockApi";
import { validateWorkflow } from "./validation";
import { loadDraft, saveDraft } from "./persistence";
import { createWorkflow, getWorkflow, updateWorkflow } from "./library";
import { autoLayout } from "./autoLayout";
import { useHistory, type HistorySnapshot } from "./useHistory";
import { checkConnection, type ConnectionFix } from "./edgeRules";
import type {
  AutomationDefinition,
  CommentNote,
  NodeKind,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from "./types";

interface DesignerProps {
  workflowId?: string;
}

const initialNodes: WorkflowNode[] = [
  {
    id: "start_seed",
    type: "start",
    position: { x: 280, y: 40 },
    data: { ...defaultDataFor("start"), title: "Onboarding kickoff" } as WorkflowNodeData,
  },
];

function Inner({ workflowId }: DesignerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);
  const [comments, setComments] = useState<Record<string, CommentNote[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState("Untitled workflow");
  const [savedId, setSavedId] = useState<string | undefined>(workflowId);
  const [hydrated, setHydrated] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);

  // ---- Undo/redo ----
  const history = useHistory({ debounceMs: 300 });
  const isApplyingHistoryRef = useRef(false);

  const applySnapshot = useCallback(
    (snap: HistorySnapshot) => {
      isApplyingHistoryRef.current = true;
      setNodes(snap.nodes);
      setEdges(snap.edges);
      setComments(snap.comments);
      // Release the guard after React has flushed the resulting effect runs.
      // We use two RAFs to make sure the recording effect (which runs after
      // commit) sees the guard as `true`.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isApplyingHistoryRef.current = false;
        });
      });
    },
    [setNodes, setEdges],
  );

  const onUndo = useCallback(() => {
    const snap = history.undo();
    if (snap) applySnapshot(snap);
    else toast.message("Nothing to undo");
  }, [history, applySnapshot]);

  const onRedo = useCallback(() => {
    const snap = history.redo();
    if (snap) applySnapshot(snap);
    else toast.message("Nothing to redo");
  }, [history, applySnapshot]);

  // Record snapshots whenever graph state changes (debounced inside useHistory).
  useEffect(() => {
    if (!hydrated) return;
    if (isApplyingHistoryRef.current) return;
    history.push({ nodes, edges, comments });
  }, [nodes, edges, comments, hydrated, history]);

  // ---- Bootstrapping ----
  useEffect(() => {
    void getAutomations().then(setAutomations);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (workflowId) {
        try {
          const wf = await getWorkflow(workflowId);
          if (cancelled) return;
          setName(wf.name);
          const ns = wf.graph.nodes.length ? wf.graph.nodes : initialNodes;
          setNodes(ns);
          setEdges(wf.graph.edges);
          setComments(wf.graph.comments ?? {});
          setSavedId(wf.id);
          history.reset({ nodes: ns, edges: wf.graph.edges, comments: wf.graph.comments ?? {} });
        } catch {
          toast.error("Could not load workflow");
        }
      } else {
        const draft = loadDraft();
        if (draft && !cancelled) {
          setNodes(draft.nodes);
          setEdges(draft.edges);
          setComments(draft.comments ?? {});
          history.reset({
            nodes: draft.nodes,
            edges: draft.edges,
            comments: draft.comments ?? {},
          });
        } else if (!cancelled) {
          history.reset({ nodes: initialNodes, edges: [], comments: {} });
        }
      }
      if (!cancelled) setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  // Auto-save draft.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveDraft({ nodes, edges, comments }), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, comments, hydrated]);

  // Mirror comment count + latest body into node.data so the node card can
  // render its badge/strip without prop-drilling.
  useEffect(() => {
    setNodes((ns) => {
      let changed = false;
      const next = ns.map((n) => {
        const list = comments[n.id] ?? [];
        const desiredCount = list.length;
        const desiredLatest = list.length
          ? list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].body
          : "";
        const cur = n.data as { commentCount?: number; comment?: string };
        if ((cur.commentCount ?? 0) === desiredCount && (cur.comment ?? "") === desiredLatest) {
          return n;
        }
        changed = true;
        return {
          ...n,
          data: {
            ...n.data,
            comment: desiredLatest,
            commentCount: desiredCount,
          } as typeof n.data,
        };
      });
      return changed ? next : ns;
    });
  }, [comments, setNodes]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // Skip undo/redo when typing in an input/textarea.
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo, onRedo]);

  // ---- Graph operations ----
  const applyConnection = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { strokeWidth: 1.75 } }, eds),
      );
    },
    [setEdges],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => checkConnection(conn as Connection, nodes, edges).ok,
    [nodes, edges],
  );

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const check = checkConnection(params, nodes, edges);
      if (!check.ok) {
        const fix = check.fix;
        toast.error(check.reason ?? "Invalid connection", {
          action: fix
            ? {
                label: fix.label,
                onClick: () => {
                  if (fix.kind === "swap") applyConnection(fix.connection);
                },
              }
            : undefined,
        });
        return;
      }
      if (check.reason && check.fix) {
        // Allowed but with a friendly nudge (e.g. "no Start node yet").
        const fix = check.fix as ConnectionFix;
        toast.warning(check.reason, {
          action:
            fix.kind === "addStart"
              ? {
                  label: fix.label,
                  onClick: () => {
                    const id = uid("start");
                    setNodes((ns) =>
                      ns.concat({
                        id,
                        type: "start",
                        position: { x: 80, y: 40 },
                        data: defaultDataFor("start"),
                      }),
                    );
                  },
                }
              : undefined,
        });
      }
      applyConnection(params);
    },
    [nodes, edges, applyConnection, setNodes],
  );

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      if (kind === "start" && nodes.some((n) => n.data.kind === "start")) {
        toast.warning("Only one Start node is allowed");
        return;
      }
      const id = uid(kind);
      const pos = position ??
        rfRef.current?.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }) ?? { x: 240, y: 200 };
      setNodes((ns) => ns.concat({ id, type: kind, position: pos, data: defaultDataFor(kind) }));
      setSelectedId(id);
    },
    [nodes, setNodes],
  );

  const applyTemplate = useCallback(
    (graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => {
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setComments({});
      setSelectedId(null);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.3 }), 50);
      toast.success("Template loaded");
    },
    [setNodes, setEdges],
  );

  const importGraph = useCallback(
    (graph: {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      comments: Record<string, CommentNote[]>;
    }) => {
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setComments(graph.comments);
      setSelectedId(null);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.3 }), 50);
      toast.success(`Imported ${graph.nodes.length} node(s)`);
    },
    [setNodes, setEdges],
  );

  const onAutoLayout = useCallback(() => {
    setNodes((ns) => autoLayout(ns, edges));
    setTimeout(() => rfRef.current?.fitView({ padding: 0.3, duration: 400 }), 60);
    toast.success("Auto-layout applied");
  }, [edges, setNodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/x-workflow-node") as NodeKind;
      if (!kind) return;
      const position = rfRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(kind, position);
    },
    [addNode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const updateNodeData = useCallback(
    (id: string, data: WorkflowNodeData) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data } : n)));
    },
    [setNodes],
  );

  const updateNodeComments = useCallback((id: string, notes: CommentNote[]) => {
    setComments((c) => ({ ...c, [id]: notes }));
  }, []);

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setComments((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges],
  );

  const handleSave = useCallback(async () => {
    try {
      if (savedId) {
        await updateWorkflow(savedId, { name, nodes, edges, comments });
        toast.success("Workflow updated");
      } else {
        const wf = await createWorkflow({ name, nodes, edges, comments });
        setSavedId(wf.id);
        toast.success("Workflow saved to library");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }, [savedId, name, nodes, edges, comments]);

  // Bumped whenever the user wants the sandbox to re-simulate against the
  // current graph (after undo/redo, auto-layout, or explicit Run click).
  const [simulationTick, setSimulationTick] = useState(0);
  const triggerSimulation = useCallback(() => {
    setSandboxOpen(true);
    setSimulationTick((t) => t + 1);
  }, []);

  // Re-simulate automatically after undo/redo or auto-layout, but only when
  // the sandbox is already open — we don't want to surprise the user.
  const onUndoAndResim = useCallback(() => {
    onUndo();
    if (sandboxOpen) setSimulationTick((t) => t + 1);
  }, [onUndo, sandboxOpen]);
  const onRedoAndResim = useCallback(() => {
    onRedo();
    if (sandboxOpen) setSimulationTick((t) => t + 1);
  }, [onRedo, sandboxOpen]);
  const onAutoLayoutAndResim = useCallback(() => {
    onAutoLayout();
    if (sandboxOpen) setSimulationTick((t) => t + 1);
  }, [onAutoLayout, sandboxOpen]);

  const exportJson = useCallback(() => {
    const data = JSON.stringify(
      { name, nodes, edges, comments, exportedAt: new Date().toISOString() },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (name || "workflow").replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Workflow exported");
  }, [name, nodes, edges, comments]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const issues = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warnCount = issues.filter((i) => i.level === "warning").length;

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-56 truncate border-none bg-transparent text-sm font-semibold leading-tight text-foreground outline-none focus:ring-0"
            />
            <div className="text-[11px] leading-tight text-muted-foreground">
              HR Workflow Designer
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-xs sm:flex">
            {errorCount > 0 && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </span>
            )}
            {warnCount > 0 && (
              <span className="rounded-full bg-[var(--node-approval)]/10 px-2 py-0.5 font-medium text-[var(--node-approval)]">
                {warnCount} warning{warnCount > 1 ? "s" : ""}
              </span>
            )}
            {errorCount === 0 && warnCount === 0 && (
              <span className="rounded-full bg-[var(--node-start)]/10 px-2 py-0.5 font-medium text-[var(--node-start)]">
                Valid
              </span>
            )}
          </div>

          <div className="hidden items-center sm:flex">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onUndoAndResim}
              disabled={!history.canUndo}
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onRedoAndResim}
              disabled={!history.canRedo}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <Button size="sm" variant="ghost" onClick={onAutoLayoutAndResim} title="Auto-layout">
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Layout
          </Button>

          <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)} title="Import JSON">
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
          </Button>

          <Button size="sm" variant="ghost" onClick={exportJson} title="Export workflow as JSON">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:inline-flex"
            title="Command palette (⌘K)"
          >
            <Command className="mr-1.5 h-3.5 w-3.5" />
            <kbd className="text-[10px] text-muted-foreground">⌘K</kbd>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link to="/library">
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Library
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save
          </Button>

          <Button size="sm" variant="outline" onClick={() => setSandboxOpen((o) => !o)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Sandbox
          </Button>
          <Button size="sm" onClick={triggerSimulation} title="Run simulation against current graph">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run
          </Button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <NodeSidebar onAdd={(k) => addNode(k)} />

        <div ref={wrapperRef} className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            onInit={(inst) => (rfRef.current = inst)}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="var(--canvas-dot)"
            />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const kind = (n.data as WorkflowNodeData | undefined)?.kind;
                switch (kind) {
                  case "start":
                    return "oklch(0.62 0.18 155)";
                  case "task":
                    return "oklch(0.6 0.17 250)";
                  case "approval":
                    return "oklch(0.65 0.18 50)";
                  case "automated":
                    return "oklch(0.6 0.2 295)";
                  case "end":
                    return "oklch(0.55 0.05 260)";
                  default:
                    return "oklch(0.7 0.02 260)";
                }
              }}
            />
          </ReactFlow>

          <SandboxPanel
            open={sandboxOpen}
            onClose={() => setSandboxOpen(false)}
            workflowName={name}
            nodes={nodes}
            edges={edges}
            comments={comments}
            runTrigger={simulationTick}
          />
        </div>

        <NodeConfigPanel
          node={selectedNode}
          automations={automations}
          comments={selectedNode ? (comments[selectedNode.id] ?? []) : []}
          onChange={updateNodeData}
          onCommentsChange={updateNodeComments}
          onDelete={deleteNode}
          onClose={() => setSelectedId(null)}
        />
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAddNode={addNode}
        onApplyTemplate={applyTemplate}
        onAutoLayout={onAutoLayout}
        onImport={() => setImportOpen(true)}
        onUndo={onUndo}
        onRedo={onRedo}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={importGraph} />
    </div>
  );
}

export function WorkflowDesigner(props: DesignerProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
