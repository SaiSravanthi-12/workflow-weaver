/**
 * Pre-built workflow templates surfaced through the command palette.
 * Each template returns a fresh graph (with new ids) when chosen.
 */
import { defaultDataFor, uid } from "./defaults";
import type { WorkflowEdge, WorkflowNode } from "./types";

export interface Template {
  id: string;
  label: string;
  description: string;
  build: () => { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
}

function node(
  kind: Parameters<typeof defaultDataFor>[0],
  position: { x: number; y: number },
  patch: Partial<Record<string, unknown>> = {},
): WorkflowNode {
  return {
    id: uid(kind),
    type: kind,
    position,
    data: { ...defaultDataFor(kind), ...patch } as WorkflowNode["data"],
  };
}

function edge(source: string, target: string): WorkflowEdge {
  return { id: `e_${source}_${target}`, source, target, animated: true };
}

export const templates: Template[] = [
  {
    id: "onboarding",
    label: "Employee onboarding",
    description: "Start → collect docs → IT account → manager intro → end",
    build: () => {
      const start = node("start", { x: 280, y: 40 }, { title: "New hire onboarding" });
      const docs = node(
        "task",
        { x: 280, y: 180 },
        {
          title: "Collect joining documents",
          description: "ID, tax forms, bank details",
          assignee: "hr.ops@company.com",
        },
      );
      const it = node(
        "automated",
        { x: 280, y: 340 },
        {
          title: "Provision IT account",
          actionId: "create_account",
          params: { employeeId: "{{employee.id}}", department: "{{employee.dept}}" },
        },
      );
      const intro = node(
        "task",
        { x: 280, y: 500 },
        {
          title: "Manager 1:1 intro",
          assignee: "manager",
        },
      );
      const end = node("end", { x: 280, y: 660 }, { message: "Onboarding complete" });
      return {
        nodes: [start, docs, it, intro, end],
        edges: [
          edge(start.id, docs.id),
          edge(docs.id, it.id),
          edge(it.id, intro.id),
          edge(intro.id, end.id),
        ],
      };
    },
  },
  {
    id: "leave",
    label: "Leave approval",
    description: "Submit → manager approval → HR notify → end",
    build: () => {
      const start = node("start", { x: 280, y: 40 }, { title: "Leave request" });
      const submit = node(
        "task",
        { x: 280, y: 180 },
        {
          title: "Submit leave request",
          assignee: "employee",
        },
      );
      const approve = node(
        "approval",
        { x: 280, y: 340 },
        {
          title: "Manager approval",
          approverRole: "Manager",
          autoApproveThreshold: 2,
        },
      );
      const notify = node(
        "automated",
        { x: 280, y: 500 },
        {
          title: "Notify HR",
          actionId: "send_email",
          params: { to: "hr@company.com", subject: "Leave approved", body: "" },
        },
      );
      const end = node("end", { x: 280, y: 660 }, { message: "Leave processed" });
      return {
        nodes: [start, submit, approve, notify, end],
        edges: [
          edge(start.id, submit.id),
          edge(submit.id, approve.id),
          edge(approve.id, notify.id),
          edge(notify.id, end.id),
        ],
      };
    },
  },
  {
    id: "verification",
    label: "Document verification",
    description: "Start → upload → automated check → HRBP review → end",
    build: () => {
      const start = node("start", { x: 280, y: 40 }, { title: "Doc verification" });
      const upload = node(
        "task",
        { x: 280, y: 180 },
        {
          title: "Upload documents",
          assignee: "candidate",
        },
      );
      const check = node(
        "automated",
        { x: 280, y: 340 },
        {
          title: "Generate verification report",
          actionId: "generate_doc",
          params: { template: "verification", recipient: "hrbp@company.com" },
        },
      );
      const review = node(
        "approval",
        { x: 280, y: 500 },
        {
          title: "HRBP review",
          approverRole: "HRBP",
          autoApproveThreshold: 0,
        },
      );
      const end = node("end", { x: 280, y: 660 }, { message: "Verification complete" });
      return {
        nodes: [start, upload, check, review, end],
        edges: [
          edge(start.id, upload.id),
          edge(upload.id, check.id),
          edge(check.id, review.id),
          edge(review.id, end.id),
        ],
      };
    },
  },
];
