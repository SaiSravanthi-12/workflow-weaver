/**
 * Per-node-kind Zod schemas. Each schema validates one node's `data` payload
 * and produces field-level error messages used inline in the config panel.
 *
 * The forms remain controlled — schemas only validate; they do not own state.
 */
import { z } from "zod";
import type { NodeKind, WorkflowNodeData } from "./types";

const kvSchema = z
  .object({
    id: z.string(),
    key: z
      .string()
      .trim()
      .max(60, "Max 60 chars"),
    value: z.string().max(500, "Max 500 chars"),
  })
  .refine(
    (kv) => kv.key.length === 0 || /^[a-zA-Z0-9_.-]+$/.test(kv.key),
    { message: "Use letters, numbers, _ . -", path: ["key"] },
  );

const startSchema = z.object({
  kind: z.literal("start"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Max 80 chars"),
  metadata: z.array(kvSchema).max(20, "Max 20 metadata entries"),
});

const taskSchema = z.object({
  kind: z.literal("task"),
  title: z.string().trim().min(1, "Title is required").max(80, "Max 80 chars"),
  description: z.string().max(500, "Max 500 chars"),
  assignee: z
    .string()
    .trim()
    .max(120, "Max 120 chars")
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[\w .'-]+$/.test(v),
      "Enter an email or a name",
    ),
  dueDate: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD"),
  customFields: z.array(kvSchema).max(20, "Max 20 fields"),
});

const approvalSchema = z.object({
  kind: z.literal("approval"),
  title: z.string().trim().min(1, "Title is required").max(80, "Max 80 chars"),
  approverRole: z.string().trim().min(1, "Pick a role"),
  autoApproveThreshold: z
    .number({ message: "Must be a number" })
    .int("Whole numbers only")
    .min(0, "Cannot be negative")
    .max(1_000_000, "Too large"),
});

const automatedSchema = z.object({
  kind: z.literal("automated"),
  title: z.string().trim().min(1, "Title is required").max(80, "Max 80 chars"),
  actionId: z.string().min(1, "Select an action"),
  params: z.record(z.string(), z.string().max(500, "Max 500 chars")),
});

const endSchema = z.object({
  kind: z.literal("end"),
  message: z.string().trim().min(1, "Message is required").max(280, "Max 280 chars"),
  summary: z.boolean(),
});

export const nodeSchemas = {
  start: startSchema,
  task: taskSchema,
  approval: approvalSchema,
  automated: automatedSchema,
  end: endSchema,
} as const;

export type FieldErrors = Partial<Record<string, string>>;

/**
 * Validate a node's data against its schema. Returns field -> message map.
 * Nested paths (e.g. `metadata.0.key`) are flattened into dot keys.
 */
export function validateNodeData(
  kind: NodeKind,
  data: WorkflowNodeData,
): FieldErrors {
  const schema = nodeSchemas[kind];
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) errors[path] = issue.message;
  }
  return errors;
}
