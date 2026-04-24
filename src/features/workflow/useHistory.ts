/**
 * Undo/redo history for the workflow graph.
 *
 * Snapshots are debounced — rapid drag/typing collapses into a single entry
 * so users can undo at meaningful checkpoints rather than per-keystroke.
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
  // Structured-clone-ish via JSON — fine for plain graph data.
  return JSON.parse(JSON.stringify(s)) as HistorySnapshot;
}

export function useHistory({ limit = 80, debounceMs = 250 }: Options = {}): UseHistory {
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const currentRef = useRef<HistorySnapshot | null>(null);
  const pendingRef = useRef<HistorySnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const commitPending = useCallback(() => {
    if (!pendingRef.current || !currentRef.current) {
      pendingRef.current = null;
      return;
    }
    const snap = pendingRef.current;
    pendingRef.current = null;
    pastRef.current.push(currentRef.current);
    if (pastRef.current.length > limit) pastRef.current.shift();
    futureRef.current = [];
    currentRef.current = snap;
    rerender();
  }, [limit, rerender]);

  const push = useCallback(
    (snap: HistorySnapshot) => {
      const cloned = clone(snap);
      if (!currentRef.current) {
        currentRef.current = cloned;
        rerender();
        return;
      }
      pendingRef.current = cloned;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(commitPending, debounceMs);
    },
    [commitPending, debounceMs, rerender],
  );

  const reset = useCallback(
    (snap: HistorySnapshot) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingRef.current = null;
      pastRef.current = [];
      futureRef.current = [];
      currentRef.current = clone(snap);
      rerender();
    },
    [rerender],
  );

  const undo = useCallback((): HistorySnapshot | null => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingRef.current) {
      // Flush pending into the past so the undo step targets the latest edit.
      if (currentRef.current) pastRef.current.push(currentRef.current);
      currentRef.current = pendingRef.current;
      pendingRef.current = null;
    }
    const prev = pastRef.current.pop();
    if (!prev || !currentRef.current) return null;
    futureRef.current.push(currentRef.current);
    currentRef.current = prev;
    rerender();
    return clone(prev);
  }, [rerender]);

  const redo = useCallback((): HistorySnapshot | null => {
    const next = futureRef.current.pop();
    if (!next || !currentRef.current) return null;
    pastRef.current.push(currentRef.current);
    currentRef.current = next;
    rerender();
    return clone(next);
  }, [rerender]);

  // Cleanup
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
    canUndo: pastRef.current.length > 0 || pendingRef.current !== null,
    canRedo: futureRef.current.length > 0,
  };
}
