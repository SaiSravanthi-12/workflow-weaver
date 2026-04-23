import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { NodeKind, WorkflowNode } from "../types";
import {
  PlayCircle,
  CheckSquare,
  ShieldCheck,
  Zap,
  Flag,
  type LucideIcon,
} from "lucide-react";

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

interface NodeShellProps {
  kind: NodeKind;
  selected: boolean;
  title: string;
  subtitle?: string;
  showSource?: boolean;
  showTarget?: boolean;
  badge?: string;
}

function NodeShell({
  kind,
  selected,
  title,
  subtitle,
  showSource = true,
  showTarget = true,
  badge,
}: NodeShellProps) {
  const Icon = ICONS[kind];
  return (
    <div
      className={cn(
        "group min-w-[220px] max-w-[260px] rounded-xl border bg-card text-card-foreground transition-all",
        "shadow-[var(--shadow-node)]",
        selected
          ? "border-primary shadow-[var(--shadow-node-selected)]"
          : "border-border hover:border-foreground/20",
      )}
    >
      {showTarget && <Handle type="target" position={Position.Top} />}
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white",
            ACCENT[kind],
          )}
        >
          <Icon className="h-4.5 w-4.5" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {kind}
            </span>
            {badge && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {badge}
              </span>
            )}
          </div>
          <div className="truncate text-sm font-semibold text-foreground">
            {title || "Untitled"}
          </div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {showSource && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}

type Props = NodeProps<WorkflowNode>;

export function StartNode({ data, selected }: Props) {
  if (data.kind !== "start") return null;
  return (
    <NodeShell
      kind="start"
      selected={!!selected}
      title={data.title}
      subtitle={
        data.metadata.length ? `${data.metadata.length} metadata` : "Entry point"
      }
      showTarget={false}
    />
  );
}

export function TaskNode({ data, selected }: Props) {
  if (data.kind !== "task") return null;
  return (
    <NodeShell
      kind="task"
      selected={!!selected}
      title={data.title}
      subtitle={
        data.assignee
          ? `Assignee: ${data.assignee}`
          : data.description || "Human task"
      }
      badge={data.dueDate || undefined}
    />
  );
}

export function ApprovalNode({ data, selected }: Props) {
  if (data.kind !== "approval") return null;
  return (
    <NodeShell
      kind="approval"
      selected={!!selected}
      title={data.title}
      subtitle={`Approver: ${data.approverRole}`}
      badge={
        data.autoApproveThreshold > 0
          ? `auto < ${data.autoApproveThreshold}`
          : undefined
      }
    />
  );
}

export function AutomatedNode({ data, selected }: Props) {
  if (data.kind !== "automated") return null;
  return (
    <NodeShell
      kind="automated"
      selected={!!selected}
      title={data.title}
      subtitle={data.actionId ? data.actionId : "No action selected"}
    />
  );
}

export function EndNode({ data, selected }: Props) {
  if (data.kind !== "end") return null;
  return (
    <NodeShell
      kind="end"
      selected={!!selected}
      title="End"
      subtitle={data.message}
      showSource={false}
      badge={data.summary ? "summary" : undefined}
    />
  );
}

export const nodeTypes = {
  start: StartNode,
  task: TaskNode,
  approval: ApprovalNode,
  automated: AutomatedNode,
  end: EndNode,
};
