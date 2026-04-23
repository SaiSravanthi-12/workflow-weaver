import { useState } from "react";
import { MessageSquare, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { CommentNote } from "./types";

interface Props {
  notes: CommentNote[];
  currentAuthor: string;
  onAdd: (text: string) => void;
  onRemove: (noteId: string) => void;
}

function formatTime(iso: string): string {
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

export function CommentThread({ notes, currentAuthor, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-secondary/30 p-3">
      <Label className="flex items-center text-xs font-medium text-foreground">
        <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
        Notes & comments
        {notes.length > 0 && (
          <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
            {notes.length}
          </span>
        )}
      </Label>

      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group rounded-md border border-border bg-background px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{n.author}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{formatTime(n.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onRemove(n.id)}
                  title="Delete note"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                {n.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <Textarea
          rows={2}
          placeholder={`Add a note as ${currentAuthor}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            ⌘/Ctrl + ↵ to post · visible on the node and in simulation
          </p>
          <Button size="sm" variant="outline" onClick={submit} disabled={!draft.trim()}>
            <Plus className="mr-1 h-3 w-3" /> Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
