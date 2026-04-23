import { PlayCircle, CheckSquare, ShieldCheck, Zap, Flag, type LucideIcon } from "lucide-react";
import type { NodeKind } from "./types";
import { NODE_DESCRIPTIONS, NODE_LABELS } from "./defaults";

const ICONS: Record<NodeKind, LucideIcon> = {
  start: PlayCircle,
  task: CheckSquare,
  approval: ShieldCheck,
  automated: Zap,
  end: Flag,
};

const ACCENT: Record<NodeKind, string> = {
  start: "bg-[var(--node-start)]",
  task: "bg-[var(--node-task)]",
  approval: "bg-[var(--node-approval)]",
  automated: "bg-[var(--node-automated)]",
  end: "bg-[var(--node-end)]",
};

const KINDS: NodeKind[] = ["start", "task", "approval", "automated", "end"];

interface SidebarProps {
  onAdd: (kind: NodeKind) => void;
}

export function NodeSidebar({ onAdd }: SidebarProps) {
  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData("application/x-workflow-node", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Node library</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag onto the canvas, or click to add.
        </p>
      </div>
      <div className="flex-1 space-y-1.5 overflow-auto p-3">
        {KINDS.map((kind) => {
          const Icon = ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              draggable
              onDragStart={(e) => onDragStart(e, kind)}
              onClick={() => onAdd(kind)}
              className="group flex w-full cursor-grab items-start gap-3 rounded-lg border border-transparent bg-background p-2.5 text-left transition-all hover:border-border hover:bg-secondary active:cursor-grabbing"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white ${ACCENT[kind]}`}
              >
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{NODE_LABELS[kind]}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {NODE_DESCRIPTIONS[kind]}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Tip: Connect nodes by dragging from the bottom handle to the top handle of the next node.
      </div>
    </aside>
  );
}
