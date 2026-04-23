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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  Play,
  Workflow,
  Sparkles,
  Save,
  FolderOpen,
  LogOut,
  LogIn,
  Command,
  Upload,
  Undo2,
  Redo2,
  LayoutTemplate,
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
import { useAuth } from "@/features/auth/AuthProvider";
import { createWorkflow, getWorkflow, updateWorkflow } from "./library";
import { addNote, removeNote } from "./comments";
import { useHistory } from "./history";
import { autoLayout } from "./autoLayout";
import type {
  AutomationDefinition,
  CommentMap,
  NodeKind,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowSnapshot,
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
  const [comments, setComments] = useState<CommentMap>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState("Untitled workflow");
  const [savedId, setSavedId] = useState<string | undefined>(workflowId);
  const [hydrated, setHydrated] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);

  const history = useHistory({ nodes: initialNodes, edges: [], comments: {} });
  // Suppress history commits while we're applying an undo/redo result.
  const suppressHistoryRef = useRef(false);

  const currentAuthor = auth.user?.email ?? auth.user?.id ?? "Anonymous";

  // Load automations once.
  useEffect(() => {
    void getAutomations().then(setAutomations);
  }, []);

  // Hydrate from Supabase (if id) or localStorage draft.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (workflowId && auth.user) {
        try {
          const wf = await getWorkflow(workflowId);
          if (cancelled) return;
          setName(wf.name);
          const ns = wf.graph.nodes.length ? wf.graph.nodes : initialNodes;
          setNodes(ns);
          setEdges(wf.graph.edges);
          setComments(wf.graph.comments);
          setSavedId(wf.id);
          history.reset({ nodes: ns, edges: wf.graph.edges, comments: wf.graph.comments });
        } catch {
          toast.error("Could not load workflow");
        }
      } else {
        const draft = loadDraft();
        if (draft && !cancelled) {
          setNodes(draft.nodes);
          setEdges(draft.edges);
          setComments(draft.comments);
          history.reset({
            nodes: draft.nodes,
            edges: draft.edges,
            comments: draft.comments,
          });
        }
      }
      if (!cancelled) setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
    // history is stable enough — intentionally not in deps to avoid re-hydration loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, auth.user, setNodes, setEdges]);

  // Auto-save draft to localStorage + commit a history snapshot.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      saveDraft({ nodes, edges, comments });
      if (!suppressHistoryRef.current) {
        history.commit({ nodes, edges, comments });
      }
      suppressHistoryRef.current = false;
    }, 350);
    return () => clearTimeout(t);
  }, [nodes, edges, comments, hydrated, history]);

  // Mirror comments into node.data so node renderers can show the badge
  // without prop-drilling. Skipped when nothing actually changes to avoid
  // an infinite render loop with React Flow's internal state.
  useEffect(() => {
    setNodes((ns) => {
      let changed = false;
      const next = ns.map((n) => {
        const desired = comments[n.id] ?? [];
        const current = (n.data as { notes?: unknown }).notes;
        if (current === desired) return n;
        changed = true;
        return { ...n, data: { ...n.data, notes: desired } as typeof n.data };
      });
      return changed ? next : ns;
    });
  }, [comments, setNodes]);

  // Apply a snapshot from undo/redo without re-committing it.
  const applySnapshot = useCallback(
    (snap: WorkflowSnapshot) => {
      suppressHistoryRef.current = true;
      setNodes(snap.nodes);
      setEdges(snap.edges);
      setComments(snap.comments);
    },
    [setNodes, setEdges],
  );

  // Listen for global Cmd+Z / Cmd+Shift+Z dispatched by the history hook.
  useEffect(() => {
    const onApply = (e: Event) => {
      const detail = (e as CustomEvent<WorkflowSnapshot>).detail;
      if (detail) applySnapshot(detail);
    };
    window.addEventListener("workflow-history-apply", onApply);
    return () => window.removeEventListener("workflow-history-apply", onApply);
  }, [applySnapshot]);

  // Cmd/Ctrl+K -> palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onConnect: OnConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 1.75 } }, eds)),
    [setEdges],
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

  const handleImport = useCallback(
    (result: { nodes: WorkflowNode[]; edges: WorkflowEdge[]; comments: CommentMap }) => {
      setNodes(result.nodes);
      setEdges(result.edges);
      setComments(result.comments);
      setSelectedId(null);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.3 }), 50);
      toast.success(`Imported ${result.nodes.length} nodes`);
    },
    [setNodes, setEdges],
  );

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const next = autoLayout(nodes, edges, "TB");
    setNodes(next);
    setTimeout(() => rfRef.current?.fitView({ padding: 0.3, duration: 300 }), 50);
    toast.success("Layout reflowed");
  }, [nodes, edges, setNodes]);

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

  const handleAddNote = useCallback(
    (nodeId: string, text: string) => {
      setComments((c) => addNote(c, nodeId, currentAuthor, text));
    },
    [currentAuthor],
  );

  const handleRemoveNote = useCallback((nodeId: string, noteId: string) => {
    setComments((c) => removeNote(c, nodeId, noteId));
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
    if (!auth.user) {
      toast.error("Sign in to save workflows");
      navigate({ to: "/login" });
      return;
    }
    try {
      if (savedId) {
        await updateWorkflow(savedId, { name, nodes, edges, comments });
        toast.success("Workflow updated");
      } else {
        const wf = await createWorkflow({ name, nodes, edges, comments });
        setSavedId(wf.id);
        toast.success("Workflow saved");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }, [auth.user, savedId, name, nodes, edges, comments, navigate]);

  const handleUndo = useCallback(() => {
    const snap = history.undo();
    if (snap) applySnapshot(snap);
  }, [history, applySnapshot]);

  const handleRedo = useCallback(() => {
    const snap = history.redo();
    if (snap) applySnapshot(snap);
  }, [history, applySnapshot]);

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
        <div className="flex items-center gap-1.5">
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

          <div className="hidden items-center gap-0.5 sm:flex">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleUndo}
              disabled={!history.canUndo}
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleRedo}
              disabled={!history.canRedo}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleAutoLayout}
              title="Auto-layout"
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setImportOpen(true)}
              title="Import JSON"
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </div>

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
          {auth.user ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link to="/library">
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Library
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => auth.signOut()} title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/login">
                <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign in
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setSandboxOpen((o) => !o)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Sandbox
          </Button>
          <Button size="sm" onClick={() => setSandboxOpen(true)}>
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
          />
        </div>

        <NodeConfigPanel
          node={selectedNode}
          automations={automations}
          notes={selectedNode ? (comments[selectedNode.id] ?? []) : []}
          currentAuthor={currentAuthor}
          onChange={updateNodeData}
          onAddNote={handleAddNote}
          onRemoveNote={handleRemoveNote}
          onDelete={deleteNode}
          onClose={() => setSelectedId(null)}
        />
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAddNode={addNode}
        onApplyTemplate={applyTemplate}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
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
