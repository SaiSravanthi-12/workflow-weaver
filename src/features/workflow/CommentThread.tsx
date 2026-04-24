/**
 * Comment thread editor — supports multiple notes per node with author and
 * timestamp so reviewer discussions don't overwrite each other.
 */
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { CommentNote } from "./types";

interface Props {
  notes: CommentNote[];
  onChange: (notes: CommentNote[]) => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CommentThread({ notes, onChange }: Props) {
  const [author, setAuthor] = useState<string>(() => {
    if (typeof window === "undefined") return "You";
    return window.localStorage.getItem("hr-workflow-designer:author") ?? "You";
  });
  const [body, setBody] = useState("");

  const persistAuthor = (v: string) => {
    setAuthor(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hr-workflow-designer:author", v);
    }
  };

  const add = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const note: CommentNote = {
      id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      author: author.trim() || "Anonymous",
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    onChange([...notes, note]);
    setBody("");
  };

  const remove = (id: string) => {
    onChange(notes.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-secondary/30 p-3">
      <Label className="flex items-center text-xs font-medium text-foreground">
        <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
        Comments
        <span className="ml-2 rounded-full bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground">
          {notes.length}
        </span>
      </Label>

      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes
            .slice()
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((n) => (
              <li
                key={n.id}
                className="group rounded-md border border-border bg-card px-2.5 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="truncate font-semibold text-foreground">{n.author}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Delete note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground/90">{n.body}</p>
              </li>
            ))}
        </ul>
      )}

      <div className="space-y-1.5 border-t border-border pt-2">
        <Input
          value={author}
          onChange={(e) => persistAuthor(e.target.value)}
          placeholder="Author"
          className="h-7 text-xs"
        />
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note for review…"
          className="text-xs"
        />
        <Button size="sm" variant="secondary" className="w-full" onClick={add} disabled={!body.trim()}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add comment
        </Button>
      </div>
    </div>
  );
}
