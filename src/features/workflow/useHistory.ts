/**
 * Undo/redo history for the workflow graph.
 *
 * Stacks live in React state so consumers re-render when `canUndo` /
 * `canRedo` change. Snapshots are debounced — rapid drag/typing collapses
 * into a single entry so users can undo at meaningful checkpoints rather
 * than per-keystroke.
 *
 * Important: callers should pass an `isApplyingExternal` flag to `push` so
 * snapshots that originate from an undo/redo round-trip aren't recorded
 * back into history.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentNote, WorkflowEdge, WorkflowNode } from "./types";

export interface HistorySnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  comments: Record<string, CommentNote[]>;
}

interface Options {
  limit?: number;
  debounceMs?: number;
}

export interface UseHistory {
  push: (snap: HistorySnapshot) => void;
  reset: (snap: HistorySnapshot) => void;
  undo: () => HistorySnapshot | null;
  redo: () => HistorySnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
}

function clone(s: HistorySnapshot): HistorySnapshot {
  return JSON.parse(JSON.stringify(s)) as HistorySnapshot;
}

function snapEqual(a: HistorySnapshot | null, b: HistorySnapshot): boolean {
  if (!a) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useHistory({ limit = 80, debounceMs = 250 }: Options = {}): UseHistory {
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const currentRef = useRef<HistorySnapshot | null>(null);
  const pendingRef = useRef<HistorySnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitPending = useCallback(() => {
    const snap = pendingRef.current;
    pendingRef.current = null;
    if (!snap || !currentRef.current) return;
    if (snapEqual(currentRef.current, snap)) return;
    setPast((p) => {
      const next = p.concat(currentRef.current!);
      if (next.length > limit) next.shift();
      return next;
    });
    setFuture([]);
    currentRef.current = snap;
  }, [limit]);

  const push = useCallback(
    (snap: HistorySnapshot) => {
      const cloned = clone(snap);
      if (!currentRef.current) {
        currentRef.current = cloned;
        return;
      }
      if (snapEqual(currentRef.current, cloned)) return;
      pendingRef.current = cloned;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(commitPending, debounceMs);
    },
    [commitPending, debounceMs],
  );

  const reset = useCallback((snap: HistorySnapshot) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPast([]);
    setFuture([]);
    currentRef.current = clone(snap);
  }, []);

  const undo = useCallback((): HistorySnapshot | null => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Flush any pending edit so the undo step targets the latest change.
    if (pendingRef.current && currentRef.current && !snapEqual(currentRef.current, pendingRef.current)) {
      const flushed = currentRef.current;
      currentRef.current = pendingRef.current;
      pendingRef.current = null;
      setPast((p) => {
        const next = p.concat(flushed);
        if (next.length > limit) next.shift();
        return next;
      });
      setFuture([]);
    } else {
      pendingRef.current = null;
    }

    let restored: HistorySnapshot | null = null;
    setPast((p) => {
      if (p.length === 0 || !currentRef.current) {
        restored = null;
        return p;
      }
      const next = p.slice(0, -1);
      restored = p[p.length - 1];
      setFuture((f) => f.concat(currentRef.current!));
      currentRef.current = restored;
      return next;
    });
    return restored ? clone(restored) : null;
  }, [limit]);

  const redo = useCallback((): HistorySnapshot | null => {
    let restored: HistorySnapshot | null = null;
    setFuture((f) => {
      if (f.length === 0 || !currentRef.current) {
        restored = null;
        return f;
      }
      const next = f.slice(0, -1);
      restored = f[f.length - 1];
      setPast((p) => {
        const out = p.concat(currentRef.current!);
        if (out.length > limit) out.shift();
        return out;
      });
      currentRef.current = restored;
      return next;
    });
    return restored ? clone(restored) : null;
  }, [limit]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    push,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
