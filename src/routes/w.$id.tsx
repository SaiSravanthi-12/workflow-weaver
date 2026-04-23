import { createFileRoute } from "@tanstack/react-router";
import { WorkflowDesigner } from "@/features/workflow/WorkflowDesigner";

export const Route = createFileRoute("/w/$id")({
  component: EditPage,
  head: () => ({ meta: [{ title: "Edit workflow" }] }),
});

function EditPage() {
  const { id } = Route.useParams();
  return <WorkflowDesigner workflowId={id} />;
}
