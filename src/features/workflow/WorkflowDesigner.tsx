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
  useReactFlow,
  type Connection,
  type OnConnect,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Play, Workflow, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nodeTypes } from "./nodes";
import { NodeSidebar } from "./NodeSidebar";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { SandboxPanel } from "./SandboxPanel";
import { defaultDataFor, uid } from "./defaults";
import { getAutomations } from "./mockApi";
import { validateWorkflow } from "./validation";
import type {
  AutomationDefinition,
  NodeKind,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from "./types";

const initialNodes: WorkflowNode[] = [
  {
    id: "start_seed",
    type: "start",
    position: { x: 280, y: 40 },
    data: { ...defaultDataFor("start"), title: "Onboarding kickoff" } as WorkflowNodeData,
  },
];

const initialEdges: WorkflowEdge[] = [];

function Inner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);

  useEffect(() => {
    void getAutomations().then(setAutomations);
  }, []);

  const onConnect: OnConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { strokeWidth: 1.75 } }, eds),
      ),
    [setEdges],
  );

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      // Enforce: only one Start node.
      if (kind === "start" && nodes.some((n) => n.data.kind === "start")) {
        return;
      }
      const id = uid(kind);
      const pos =
        position ??
        rfRef.current?.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }) ?? { x: 240, y: 200 };
      const newNode: WorkflowNode = {
        id,
        type: kind,
        position: pos,
        data: defaultDataFor(kind),
      };
      setNodes((ns) => ns.concat(newNode));
      setSelectedId(id);
    },
    [nodes, setNodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(
        "application/x-workflow-node",
      ) as NodeKind;
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

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const issues = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warnCount = issues.filter((i) => i.level === "warning").length;

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-foreground">
              HR Workflow Designer
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              Onboarding · Leave · Verification
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSandboxOpen((o) => !o)}
          >
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

        <div
          ref={wrapperRef}
          className="relative flex-1"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
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
            nodes={nodes}
            edges={edges}
          />
        </div>

        <NodeConfigPanel
          node={selectedNode}
          automations={automations}
          onChange={updateNodeData}
          onDelete={deleteNode}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}

export function WorkflowDesigner() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
