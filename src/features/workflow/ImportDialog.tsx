import { useCallback, useState } from "react";
import { Upload, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseImport, type ImportResult } from "./importSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: ImportResult) => void;
}

const SAMPLE = `{
  "nodes": [
    {
      "id": "start_1",
      "type": "start",
      "position": { "x": 280, "y": 40 },
      "data": { "kind": "start", "title": "Kickoff", "metadata": [] }
    }
  ],
  "edges": [],
  "comments": {}
}`;

export function ImportDialog({ open, onOpenChange, onImport }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setText(result);
    };
    reader.readAsText(file);
  }, []);

  const submit = () => {
    setError(null);
    try {
      const result = parseImport(text);
      onImport(result);
      onOpenChange(false);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import workflow JSON
          </DialogTitle>
          <DialogDescription>
            Paste a JSON document with <code>nodes</code>, <code>edges</code>, and (optionally){" "}
            <code>comments</code>. The current canvas will be replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70">
              <Upload className="h-3.5 w-3.5" />
              Choose .json file
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setText(SAMPLE)}
            >
              Insert sample
            </button>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "nodes": [...], "edges": [...], "comments": {...} }'
            rows={14}
            spellCheck={false}
            className="font-mono text-xs"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!text.trim()}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
