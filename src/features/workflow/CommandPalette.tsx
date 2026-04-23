import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { PlayCircle, CheckSquare, ShieldCheck, Zap, Flag, FileText } from "lucide-react";
import type { NodeKind, WorkflowEdge, WorkflowNode } from "./types";
import { templates } from "./templates";
import { NODE_DESCRIPTIONS, NODE_LABELS } from "./defaults";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: (kind: NodeKind) => void;
  onApplyTemplate: (graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
}

const NODE_ICONS: Record<NodeKind, React.ComponentType<{ className?: string }>> = {
  start: PlayCircle,
  task: CheckSquare,
  approval: ShieldCheck,
  automated: Zap,
  end: Flag,
};

export function CommandPalette({ open, onOpenChange, onAddNode, onApplyTemplate }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Global Cmd/Ctrl+K opener — bound at module consumer level too, but ensure here.
  const kinds = useMemo<NodeKind[]>(() => ["start", "task", "approval", "automated", "end"], []);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Add nodes, apply templates… (⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>

        <CommandGroup heading="Add node">
          {kinds.map((k) => {
            const Icon = NODE_ICONS[k];
            return (
              <CommandItem
                key={k}
                value={`add ${NODE_LABELS[k]} node ${NODE_DESCRIPTIONS[k]}`}
                onSelect={() => {
                  onAddNode(k);
                  onOpenChange(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Add {NODE_LABELS[k]} node</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {NODE_DESCRIPTIONS[k]}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Templates">
          {templates.map((t) => (
            <CommandItem
              key={t.id}
              value={`template ${t.label} ${t.description}`}
              onSelect={() => {
                onApplyTemplate(t.build());
                onOpenChange(false);
              }}
            >
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{t.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{t.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
