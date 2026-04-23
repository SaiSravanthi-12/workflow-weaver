import { createFileRoute } from "@tanstack/react-router";
import { WorkflowDesigner } from "@/features/workflow/WorkflowDesigner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "HR Workflow Designer" },
      {
        name: "description",
        content:
          "Visually design and simulate HR workflows — onboarding, leave approval, document verification — with a React Flow canvas, configurable nodes, and a mock execution sandbox.",
      },
      { property: "og:title", content: "HR Workflow Designer" },
      {
        property: "og:description",
        content: "A React Flow prototype for designing and simulating HR workflows.",
      },
    ],
  }),
});

function Index() {
  return <WorkflowDesigner />;
}
