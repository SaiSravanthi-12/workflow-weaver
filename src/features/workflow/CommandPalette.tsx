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
import {
  PlayCircle,
  CheckSquare,
  ShieldCheck,
  Zap,
  Flag,
  FileText,
  LayoutGrid,
  Upload,
  Undo2,
  Redo2,
} from "lucide-react";
import type { NodeKind, WorkflowEdge, WorkflowNode } from "./types";
import { templates } from "./templates";
import { NODE_DESCRIPTIONS, NODE_LABELS } from "./defaults";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: (kind: NodeKind) => void;
  onApplyTemplate: (graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
  onAutoLayout: () => void;
  onImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const NODE_ICONS: Record<NodeKind, React.ComponentType<{ className?: string }>> = {
  start: PlayCircle,
  task: CheckSquare,
  approval: ShieldCheck,
  automated: Zap,
  end: Flag,
};

export function CommandPalette({
  open,
  onOpenChange,
  onAddNode,
  onApplyTemplate,
  onAutoLayout,
  onImport,
  onUndo,
  onRedo,
}: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const kinds = useMemo<NodeKind[]>(() => ["start", "task", "approval", "automated", "end"], []);

  const close = () => onOpenChange(false);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Add nodes, apply templates, run actions… (⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            value="auto layout arrange tidy graph"
            onSelect={() => {
              onAutoLayout();
              close();
            }}
          >
            <LayoutGrid className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Auto-layout graph</span>
          </CommandItem>
          <CommandItem
            value="import json paste workflow"
            onSelect={() => {
              onImport();
              close();
            }}
          >
            <Upload className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Import JSON…</span>
          </CommandItem>
          <CommandItem
            value="undo revert last change"
            onSelect={() => {
              onUndo();
              close();
            }}
          >
            <Undo2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Undo</span>
            <span className="ml-auto text-[10px] text-muted-foreground">⌘Z</span>
          </CommandItem>
          <CommandItem
            value="redo restore reapply"
            onSelect={() => {
              onRedo();
              close();
            }}
          >
            <Redo2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Redo</span>
            <span className="ml-auto text-[10px] text-muted-foreground">⌘⇧Z</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Add node">
          {kinds.map((k) => {
            const Icon = NODE_ICONS[k];
            return (
              <CommandItem
                key={k}
                value={`add ${NODE_LABELS[k]} node ${NODE_DESCRIPTIONS[k]}`}
                onSelect={() => {
                  onAddNode(k);
                  close();
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
                close();
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
