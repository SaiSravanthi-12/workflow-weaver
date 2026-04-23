import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KeyValue } from "./types";
import { uid } from "./defaults";

interface KVEditorProps {
  label: string;
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
}

export function KVEditor({ label, items, onChange }: KVEditorProps) {
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));
  const add = () =>
    onChange([...items, { id: uid("kv"), key: "", value: "" }]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={add}
        >
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No entries yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-1.5">
              <Input
                value={it.key}
                placeholder="key"
                className="h-8 flex-1 text-sm"
                onChange={(e) => update(it.id, { key: e.target.value })}
              />
              <Input
                value={it.value}
                placeholder="value"
                className="h-8 flex-1 text-sm"
                onChange={(e) => update(it.id, { value: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove(it.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
