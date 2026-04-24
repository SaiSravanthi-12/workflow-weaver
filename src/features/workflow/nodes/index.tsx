import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { NodeKind, WorkflowNode } from "../types";
import {
  PlayCircle,
  CheckSquare,
  ShieldCheck,
  Zap,
  Flag,
  MessageSquare,
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
  comment?: string;
  commentCount?: number;
}

function NodeShell({
  kind,
  selected,
  title,
  subtitle,
  showSource = true,
  showTarget = true,
  badge,
  comment,
  commentCount = 0,
}: NodeShellProps) {
  const Icon = ICONS[kind];
  const hasComment = commentCount > 0 || (!!comment && comment.trim().length > 0);
  const count = commentCount > 0 ? commentCount : hasComment ? 1 : 0;
  return (
    <div
      className={cn(
        "group relative min-w-[220px] max-w-[260px] rounded-xl border bg-card text-card-foreground transition-all",
        "shadow-[var(--shadow-node)]",
        selected
          ? "border-primary shadow-[var(--shadow-node-selected)]"
          : "border-border hover:border-foreground/20",
      )}
    >
      {hasComment && (
        <div
          className="absolute -right-1.5 -top-1.5 z-10 flex h-5 items-center gap-0.5 rounded-full bg-[var(--node-approval)] px-1.5 text-[10px] font-semibold text-white shadow-sm ring-2 ring-card"
          title={`${count} comment${count > 1 ? "s" : ""}${comment ? `: ${comment}` : ""}`}
        >
          <MessageSquare className="h-2.5 w-2.5" />
          <span>{count}</span>
        </div>
      )}
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
          {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {hasComment && comment && (
        <div className="flex items-start gap-1.5 border-t border-dashed border-border bg-secondary/40 px-3 py-1.5">
          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{comment}</p>
        </div>
      )}
      {showSource && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}

type Props = NodeProps<WorkflowNode>;

function commentMeta(data: WorkflowNode["data"]) {
  return {
    comment: typeof (data as { comment?: unknown }).comment === "string"
      ? ((data as { comment?: string }).comment as string)
      : undefined,
    commentCount:
      typeof (data as { commentCount?: unknown }).commentCount === "number"
        ? ((data as { commentCount?: number }).commentCount as number)
        : 0,
  };
}

export function StartNode({ data, selected }: Props) {
  if (data.kind !== "start") return null;
  const { comment, commentCount } = commentMeta(data);
  return (
    <NodeShell
      kind="start"
      selected={!!selected}
      title={data.title}
      subtitle={data.metadata.length ? `${data.metadata.length} metadata` : "Entry point"}
      showTarget={false}
      comment={comment}
      commentCount={commentCount}
    />
  );
}

export function TaskNode({ data, selected }: Props) {
  if (data.kind !== "task") return null;
  const { comment, commentCount } = commentMeta(data);
  return (
    <NodeShell
      kind="task"
      selected={!!selected}
      title={data.title}
      subtitle={data.assignee ? `Assignee: ${data.assignee}` : data.description || "Human task"}
      badge={data.dueDate || undefined}
      comment={comment}
      commentCount={commentCount}
    />
  );
}

export function ApprovalNode({ data, selected }: Props) {
  if (data.kind !== "approval") return null;
  const { comment, commentCount } = commentMeta(data);
  return (
    <NodeShell
      kind="approval"
      selected={!!selected}
      title={data.title}
      subtitle={`Approver: ${data.approverRole}`}
      badge={data.autoApproveThreshold > 0 ? `auto < ${data.autoApproveThreshold}` : undefined}
      comment={comment}
      commentCount={commentCount}
    />
  );
}

export function AutomatedNode({ data, selected }: Props) {
  if (data.kind !== "automated") return null;
  const { comment, commentCount } = commentMeta(data);
  return (
    <NodeShell
      kind="automated"
      selected={!!selected}
      title={data.title}
      subtitle={data.actionId ? data.actionId : "No action selected"}
      comment={comment}
      commentCount={commentCount}
    />
  );
}

export function EndNode({ data, selected }: Props) {
  if (data.kind !== "end") return null;
  const { comment, commentCount } = commentMeta(data);
  return (
    <NodeShell
      kind="end"
      selected={!!selected}
      title="End"
      subtitle={data.message}
      showSource={false}
      badge={data.summary ? "summary" : undefined}
      comment={comment}
      commentCount={commentCount}
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
