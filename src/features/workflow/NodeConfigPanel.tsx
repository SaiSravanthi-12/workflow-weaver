import { useEffect, useMemo, useState } from "react";
import { Trash2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AutomationDefinition,
  CommentNote,
  WorkflowNode,
  WorkflowNodeData,
} from "./types";
import { KVEditor } from "./KVEditor";
import { NODE_LABELS } from "./defaults";
import { validateNodeData, type FieldErrors } from "./schemas";
import { CommentThread } from "./CommentThread";

interface ConfigPanelProps {
  node: WorkflowNode | null;
  automations: AutomationDefinition[];
  notes: CommentNote[];
  currentAuthor: string;
  onChange: (id: string, data: WorkflowNodeData) => void;
  onAddNote: (nodeId: string, text: string) => void;
  onRemoveNote: (nodeId: string, noteId: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NodeConfigPanel({
  node,
  automations,
  notes,
  currentAuthor,
  onChange,
  onAddNote,
  onRemoveNote,
  onDelete,
  onClose,
}: ConfigPanelProps) {
  const errors = useMemo<FieldErrors>(
    () => (node ? validateNodeData(node.data.kind, node.data) : {}),
    [node],
  );
  const errorCount = Object.keys(errors).length;

  if (!node) {
    return (
      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Node properties</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select a node to edit its configuration.
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
          No node selected.
        </div>
      </aside>
    );
  }

  const kind = node.data.kind;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-start justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {NODE_LABELS[kind]} node
            </span>
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                <AlertCircle className="h-2.5 w-2.5" />
                {errorCount} issue{errorCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h2 className="text-sm font-semibold text-foreground">Edit properties</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-4">
        {kind === "start" && (
          <StartForm data={node.data} errors={errors} onChange={(d) => onChange(node.id, d)} />
        )}
        {kind === "task" && (
          <TaskForm data={node.data} errors={errors} onChange={(d) => onChange(node.id, d)} />
        )}
        {kind === "approval" && (
          <ApprovalForm data={node.data} errors={errors} onChange={(d) => onChange(node.id, d)} />
        )}
        {kind === "automated" && (
          <AutomatedForm
            data={node.data}
            errors={errors}
            automations={automations}
            onChange={(d) => onChange(node.id, d)}
          />
        )}
        {kind === "end" && (
          <EndForm data={node.data} errors={errors} onChange={(d) => onChange(node.id, d)} />
        )}

        <CommentThread
          notes={notes}
          currentAuthor={currentAuthor}
          onAdd={(text) => onAddNote(node.id, text)}
          onRemove={(noteId) => onRemoveNote(node.id, noteId)}
        />
      </div>

      <div className="border-t border-border p-3">
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete node
        </Button>
      </div>
    </aside>
  );
}

/* ----------------------------- Form primitives ---------------------------- */

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const invalid = !!error;
  return (
    <div className="space-y-1.5">
      <Label
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          invalid ? "text-destructive" : "text-foreground",
        )}
      >
        {label}
        {required && <span className="text-destructive">*</span>}
        {invalid && (
          <span
            className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
            title={error}
          >
            <AlertCircle className="h-2.5 w-2.5" />
            invalid
          </span>
        )}
      </Label>
      <div className={cn(invalid && "[&_input]:border-destructive [&_textarea]:border-destructive [&_button]:border-destructive")}>
        {children}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Per-kind forms ---------------------------- */

function StartForm({
  data,
  errors,
  onChange,
}: {
  data: Extract<WorkflowNodeData, { kind: "start" }>;
  errors: FieldErrors;
  onChange: (d: WorkflowNodeData) => void;
}) {
  return (
    <>
      <Field label="Start title" required error={errors.title}>
        <Input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
        />
      </Field>
      <KVEditor
        label="Metadata"
        items={data.metadata}
        onChange={(metadata) => onChange({ ...data, metadata })}
      />
    </>
  );
}

function TaskForm({
  data,
  errors,
  onChange,
}: {
  data: Extract<WorkflowNodeData, { kind: "task" }>;
  errors: FieldErrors;
  onChange: (d: WorkflowNodeData) => void;
}) {
  return (
    <>
      <Field label="Title" required error={errors.title}>
        <Input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
        />
      </Field>
      <Field label="Description" error={errors.description}>
        <Textarea
          rows={3}
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
        />
      </Field>
      <Field label="Assignee" error={errors.assignee}>
        <Input
          placeholder="e.g. jane.doe@company.com"
          value={data.assignee}
          onChange={(e) => onChange({ ...data, assignee: e.target.value })}
        />
      </Field>
      <Field label="Due date" error={errors.dueDate}>
        <Input
          type="date"
          value={data.dueDate}
          onChange={(e) => onChange({ ...data, dueDate: e.target.value })}
        />
      </Field>
      <KVEditor
        label="Custom fields"
        items={data.customFields}
        onChange={(customFields) => onChange({ ...data, customFields })}
      />
    </>
  );
}

function ApprovalForm({
  data,
  errors,
  onChange,
}: {
  data: Extract<WorkflowNodeData, { kind: "approval" }>;
  errors: FieldErrors;
  onChange: (d: WorkflowNodeData) => void;
}) {
  return (
    <>
      <Field label="Title" required error={errors.title}>
        <Input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
        />
      </Field>
      <Field label="Approver role" error={errors.approverRole}>
        <Select
          value={data.approverRole}
          onValueChange={(approverRole) => onChange({ ...data, approverRole })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Manager", "HRBP", "Director", "VP", "Finance"].map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Auto-approve threshold" error={errors.autoApproveThreshold}>
        <Input
          type="number"
          min={0}
          value={data.autoApproveThreshold}
          onChange={(e) =>
            onChange({
              ...data,
              autoApproveThreshold: Number(e.target.value) || 0,
            })
          }
        />
      </Field>
    </>
  );
}

function AutomatedForm({
  data,
  errors,
  automations,
  onChange,
}: {
  data: Extract<WorkflowNodeData, { kind: "automated" }>;
  errors: FieldErrors;
  automations: AutomationDefinition[];
  onChange: (d: WorkflowNodeData) => void;
}) {
  const action = automations.find((a) => a.id === data.actionId);
  const [touched, setTouched] = useState(data.actionId);
  useEffect(() => setTouched(data.actionId), [data.actionId]);

  return (
    <>
      <Field label="Title" required error={errors.title}>
        <Input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
        />
      </Field>
      <Field label="Action" required error={errors.actionId}>
        <Select
          value={data.actionId || undefined}
          onValueChange={(actionId) => {
            const next = automations.find((a) => a.id === actionId);
            const params: Record<string, string> = {};
            next?.params.forEach((p) => (params[p] = data.params[p] ?? ""));
            onChange({ ...data, actionId, params });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an automation" />
          </SelectTrigger>
          <SelectContent>
            {automations.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {action && touched && (
        <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="text-xs font-medium text-foreground">Action parameters</div>
          {action.params.length === 0 && (
            <p className="text-xs text-muted-foreground">
              This action takes no parameters.
            </p>
          )}
          {action.params.map((p) => (
            <Field key={p} label={p} error={errors[`params.${p}`]}>
              <Input
                value={data.params[p] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...data,
                    params: { ...data.params, [p]: e.target.value },
                  })
                }
              />
            </Field>
          ))}
        </div>
      )}
    </>
  );
}

function EndForm({
  data,
  errors,
  onChange,
}: {
  data: Extract<WorkflowNodeData, { kind: "end" }>;
  errors: FieldErrors;
  onChange: (d: WorkflowNodeData) => void;
}) {
  return (
    <>
      <Field label="End message" required error={errors.message}>
        <Textarea
          rows={3}
          value={data.message}
          onChange={(e) => onChange({ ...data, message: e.target.value })}
        />
      </Field>
      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3">
        <div>
          <div className="text-sm font-medium text-foreground">Generate summary</div>
          <div className="text-xs text-muted-foreground">
            Compile a recap when the workflow completes.
          </div>
        </div>
        <Switch
          checked={data.summary}
          onCheckedChange={(summary) => onChange({ ...data, summary })}
        />
      </div>
    </>
  );
}
