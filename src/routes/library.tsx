import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Plus, Trash2, Workflow } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { deleteWorkflow, listWorkflows, type SavedWorkflow } from "@/features/workflow/library";
import { toast } from "sonner";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "My workflows" }] }),
});

function LibraryPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedWorkflow[] | null>(null);

  useEffect(() => {
    if (!auth.loading && !auth.user) navigate({ to: "/login" });
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    if (!auth.user) return;
    void listWorkflows()
      .then(setItems)
      .catch(() => toast.error("Could not load workflows"));
  }, [auth.user]);

  const remove = async (id: string) => {
    try {
      await deleteWorkflow(id);
      setItems((cur) => (cur ? cur.filter((w) => w.id !== id) : cur));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  if (!auth.user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">My workflows</div>
            <div className="text-[11px] text-muted-foreground">{auth.user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Designer
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {items === null ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">No saved workflows yet.</p>
            <Button asChild className="mt-4">
              <Link to="/">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Create your first workflow
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-foreground/20"
              >
                <Link to="/w/$id" params={{ id: w.id }} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{w.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {w.graph.nodes.length} nodes · {w.graph.edges.length} edges · updated{" "}
                    {new Date(w.updated_at).toLocaleString()}
                  </div>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(w.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
