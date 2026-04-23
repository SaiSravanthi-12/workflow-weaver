/**
 * Tiny undo/redo store for the workflow designer.
 *
 * The store is intentionally small and dumb — it holds an array of
 * `WorkflowSnapshot`s and a cursor. Consumers `commit(snapshot)` whenever the
 * graph changes (debounced upstream) and `undo()` / `redo()` to navigate.
 *
 * Snapshots are deep-cloned on commit so React Flow's mutable mid-drag
 * state can't bleed into history.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkflowSnapshot } from "./types";

const MAX_HISTORY = 60;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function shallowEqualGraph(a: WorkflowSnapshot, b: WorkflowSnapshot): boolean {
  // Cheap signature comparison — avoids pushing a new entry when nothing
  // semantically changed (e.g. selection-only React Flow updates).
  return (
    a.nodes.length === b.nodes.length &&
    a.edges.length === b.edges.length &&
    JSON.stringify(a) === JSON.stringify(b)
  );
}

export interface HistoryControls {
  commit: (snapshot: WorkflowSnapshot) => void;
  undo: () => WorkflowSnapshot | null;
  redo: () => WorkflowSnapshot | null;
  reset: (snapshot: WorkflowSnapshot) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory(initial: WorkflowSnapshot): HistoryControls {
  const stackRef = useRef<WorkflowSnapshot[]>([clone(initial)]);
  const cursorRef = useRef(0);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const commit = useCallback(
    (snapshot: WorkflowSnapshot) => {
      const stack = stackRef.current;
      const current = stack[cursorRef.current];
      if (current && shallowEqualGraph(current, snapshot)) return;
      // Drop the redo tail.
      const trimmed = stack.slice(0, cursorRef.current + 1);
      trimmed.push(clone(snapshot));
      // Cap history length.
      const overflow = trimmed.length - MAX_HISTORY;
      if (overflow > 0) trimmed.splice(0, overflow);
      stackRef.current = trimmed;
      cursorRef.current = trimmed.length - 1;
      rerender();
    },
    [rerender],
  );

  const undo = useCallback((): WorkflowSnapshot | null => {
    if (cursorRef.current <= 0) return null;
    cursorRef.current -= 1;
    rerender();
    return clone(stackRef.current[cursorRef.current]);
  }, [rerender]);

  const redo = useCallback((): WorkflowSnapshot | null => {
    if (cursorRef.current >= stackRef.current.length - 1) return null;
    cursorRef.current += 1;
    rerender();
    return clone(stackRef.current[cursorRef.current]);
  }, [rerender]);

  const reset = useCallback(
    (snapshot: WorkflowSnapshot) => {
      stackRef.current = [clone(snapshot)];
      cursorRef.current = 0;
      rerender();
    },
    [rerender],
  );

  // Bind Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "z") return;
      // Don't hijack typing in inputs / textareas / contenteditables.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) {
        const next = redo();
        if (next) window.dispatchEvent(new CustomEvent("workflow-history-apply", { detail: next }));
      } else {
        const prev = undo();
        if (prev) window.dispatchEvent(new CustomEvent("workflow-history-apply", { detail: prev }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return {
    commit,
    undo,
    redo,
    reset,
    canUndo: cursorRef.current > 0,
    canRedo: cursorRef.current < stackRef.current.length - 1,
  };
}
