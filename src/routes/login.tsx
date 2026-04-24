/**
 * Auth removed — this page accepts any input (or none) and immediately
 * redirects into the designer. It exists only so old `/login` links and
 * any cached deep links still resolve cleanly.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Enter · HR Workflow Designer" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auto-redirect after mount — anyone landing here goes straight in.
  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/" }), 0);
    return () => clearTimeout(t);
  }, [navigate]);

  const enter = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-panel)]">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">HR Workflow Designer</div>
            <div className="text-[11px] text-muted-foreground">No sign-in required</div>
          </div>
        </div>

        <form onSubmit={enter} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email (optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password (optional)</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Enter designer <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Authentication is disabled in this build — anything you type is accepted.
        </p>
      </div>
    </div>
  );
}
