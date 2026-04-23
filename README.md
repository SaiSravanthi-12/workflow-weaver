# HR Workflow Designer

A visual workflow designer prototype for HR processes (onboarding, leave
approval, document verification), built with **React + React Flow + TypeScript**
on a TanStack Start template.

> Time-boxed prototype. Focused on architectural clarity, type safety, and
> a working sandbox — not pixel-perfect UI.

## Run

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # production build
```

## Architecture

```
src/features/workflow/
├── types.ts                  # Discriminated union of node data + simulation/validation types
├── defaults.ts               # uid(), defaultDataFor(kind), labels
├── mockApi.ts                # GET /automations + POST /simulate (in-memory, promise-based)
├── validation.ts             # Static graph validation (start/end/orphans/cycles)
├── nodes/index.tsx           # 5 custom node components + nodeTypes map
├── NodeSidebar.tsx           # Drag-source palette
├── NodeConfigPanel.tsx       # Per-kind editing forms (controlled)
├── KVEditor.tsx              # Reusable key/value editor
├── SandboxPanel.tsx          # Validation + simulate + timeline log + JSON export
└── WorkflowDesigner.tsx      # Composition root: canvas + panels + state
```

### Design choices

- **Discriminated union for node data** (`WorkflowNodeData`). `kind` narrows
  every form, simulator branch, and node renderer — no `any`, no casts.
- **Strict separation of concerns**: canvas wiring (`WorkflowDesigner`),
  graph validation (`validation.ts`), API (`mockApi.ts`), and per-kind UI
  (`nodes/`, `NodeConfigPanel`) are all independently replaceable.
- **Adding a new node kind** = (1) extend the union in `types.ts`,
  (2) add defaults in `defaults.ts`, (3) add a node component + map entry,
  (4) add a form branch in `NodeConfigPanel`. Nothing else changes.
- **Mock API mirrors a real one** — promise-based with latency — so swapping
  to `fetch` later is trivial.
- **Form panel is fully controlled**: every keystroke writes back into
  `nodes[i].data`, so the canvas preview stays in sync and the serialized
  graph is always current.
- **Single source of truth** for the graph lives in React Flow's
  `useNodesState` / `useEdgesState`; selection is a separate `selectedId`
  so selecting doesn't churn node positions.

### Mock API

- `getAutomations()` — returns the action catalog used by the Automated
  Step form. Each entry declares its `params`, which dynamically render
  the parameter inputs.
- `simulateWorkflow({ nodes, edges })` — BFS from the Start node, emits a
  step per visited node with `status: ok | warn | error`. Cycles can't hang
  it because visited nodes are skipped.

### Validation

`validateWorkflow()` flags:
- Missing or duplicate Start node
- Missing End node (warning)
- Orphan nodes (warning)
- Cycles (error, DFS coloring)
- Automated nodes with no action (warning)

The header shows a live error/warning count; the sandbox blocks Run when
errors exist.

## Completed vs. nice-to-have

**Completed**
- React Flow canvas, drag-from-sidebar, click-to-add, connect, select,
  delete (Backspace/Delete + panel button)
- 5 fully typed custom nodes with kind-specific accent + icon
- Per-kind config forms (Start / Task / Approval / Automated / End) with
  KV editor, dynamic action params, role select, date input, switch
- Mock API (`getAutomations`, `simulateWorkflow`) with realistic latency
- Sandbox panel: validation block, run, step-by-step timeline log,
  per-step status + duration
- JSON export of the graph
- MiniMap, Controls, dotted background, themed via design tokens
- Live header status (errors / warnings / valid)

**Would add with more time**
- JSON import (paired with the existing export)
- Undo/redo (history middleware around `setNodes` / `setEdges`)
- Per-node validation badges rendered on the node itself
- Auto-layout (Dagre/ELK) for imported graphs
- Zod schemas per node-kind to validate forms on blur, surface errors inline
- Persisted templates (localStorage) and a "Load template" menu
