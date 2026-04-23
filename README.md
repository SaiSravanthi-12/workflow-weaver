# HR Workflow Designer

A visual workflow designer for HR processes (onboarding, leave approval,
document verification), built with **React + React Flow + TypeScript** on a
TanStack Start template, with a Lovable Cloud (Supabase) backend for auth and
per-user persistence.

## Run

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # production build
```

The `.env` file is auto-managed by Lovable Cloud and contains
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No manual config
needed for local dev.

## Routes

| Route | Description |
| ----- | ----------- |
| `/` | Workflow designer canvas (autosaved to localStorage when signed out). |
| `/login` | Email/password + Google sign-in. |
| `/library` | List of the signed-in user's saved workflows. |
| `/w/$id` | Open a saved workflow for editing. |
| `GET /api/automations` | Catalog of automations for "Automated step" nodes. |
| `POST /api/simulate` | Server-side BFS simulator returning the execution log. |

## Architecture

```
src/
├── routes/
│   ├── index.tsx                    # / — designer (anonymous draft)
│   ├── login.tsx                    # /login
│   ├── library.tsx                  # /library — user workflow list
│   ├── w.$id.tsx                    # /w/:id — load + edit a saved workflow
│   ├── api.automations.ts           # GET /api/automations
│   └── api.simulate.ts              # POST /api/simulate (Zod-validated)
├── features/
│   ├── auth/AuthProvider.tsx        # Supabase session + signIn/Up/Out
│   └── workflow/
│       ├── types.ts                 # Discriminated union of node data + sim/validation types
│       ├── defaults.ts              # uid(), defaultDataFor(kind), labels, descriptions
│       ├── schemas.ts               # Per-kind Zod schemas → field-level error map
│       ├── validation.ts            # Static graph validation (start/end/orphans/cycles)
│       ├── mockApi.ts               # Thin client → /api/automations + /api/simulate
│       ├── library.ts               # Supabase CRUD over the `workflows` table
│       ├── persistence.ts           # localStorage draft (anonymous users)
│       ├── templates.ts             # Pre-built graphs (onboarding, leave, verification)
│       ├── pdfExport.ts             # jsPDF report of a simulation run
│       ├── nodes/index.tsx          # 5 custom node components + nodeTypes map
│       ├── NodeSidebar.tsx          # Drag-source palette
│       ├── NodeConfigPanel.tsx      # Per-kind forms with Zod field errors + comment field
│       ├── KVEditor.tsx             # Reusable key/value editor
│       ├── CommandPalette.tsx       # ⌘K — quick add nodes / apply templates
│       ├── SandboxPanel.tsx         # Validation + simulate + timeline + JSON/PDF export
│       └── WorkflowDesigner.tsx     # Composition root — canvas, panels, state, autosave
└── integrations/supabase/
    ├── client.ts                    # Browser client (RLS applies)
    ├── client.server.ts             # Admin client (server-only)
    ├── auth-middleware.ts           # `requireSupabaseAuth` for server fns
    └── types.ts                     # Auto-generated DB types
```

### Design choices

- **Discriminated union for node data** (`WorkflowNodeData`). `kind` narrows
  every form, simulator branch, and node renderer — no `any`, no casts.
- **Strict separation of concerns**: canvas wiring (`WorkflowDesigner`),
  graph validation (`validation.ts`), HTTP API (`mockApi.ts`), persistence
  (`library.ts` / `persistence.ts`), and per-kind UI (`nodes/`,
  `NodeConfigPanel`) are all independently replaceable.
- **Adding a new node kind** = (1) extend the union in `types.ts`, (2) add
  defaults in `defaults.ts`, (3) add a node component + map entry, (4) add a
  form branch + Zod schema. Nothing else changes.
- **Form panel is fully controlled** + Zod-validated: every keystroke writes
  back into `nodes[i].data`, the schema runs on each render, and per-field
  errors render under each input.
- **Single source of truth** for the graph lives in React Flow's
  `useNodesState` / `useEdgesState`; selection is a separate `selectedId` so
  selecting doesn't churn node positions. Comments are kept in their own
  map (`Record<nodeId, string>`) and mirrored into `node.data.comment` so
  node renderers can show a badge without prop drilling.

## Server API

The simulator and automations catalog are now real HTTP endpoints (TanStack
Start server routes), replacing the previous in-memory client mock.

- **`GET /api/automations`** — returns `{ automations: AutomationDefinition[] }`.
  Each entry declares its `params`, which dynamically render the parameter
  inputs in the Automated Step form.
- **`POST /api/simulate`** — body: `{ nodes: { id, data }[], edges: { source, target }[] }`.
  Zod-validated. Walks BFS from the Start node, emits one step per visited
  node with `status: ok | warn | error`. Cycles can't hang it — visited
  nodes are skipped. Returns a `SimulationResult` whose shape the sandbox
  panel renders verbatim.

The client wrapper in `features/workflow/mockApi.ts` keeps the original
function signatures (`getAutomations`, `simulateWorkflow`) so swapping
back to a different transport later is a one-file change.

### Validation

`validateWorkflow()` flags:

- Missing or duplicate Start node (error)
- Missing End node (warning)
- Orphan nodes (warning)
- Cycles (error, DFS coloring)
- Automated nodes with no action (warning)

The header shows a live error/warning count; the sandbox blocks **Run** when
errors exist.

## Auth & user library

Auth is handled by Lovable Cloud (Supabase under the hood):

- `/login` supports **email/password** and **Google OAuth**. Sessions
  persist via `localStorage`.
- `AuthProvider` exposes `{ user, loading, signIn, signUp, signInWithGoogle,
  signOut }` to the app.
- The `workflows` table has **Row-Level Security** so a user only sees their
  own rows. CRUD lives in `features/workflow/library.ts`
  (`listWorkflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`,
  `deleteWorkflow`).
- `/library` lists saved workflows; clicking one routes to `/w/$id` which
  hydrates the canvas from Supabase.
- When **not signed in**, the canvas autosaves a draft to `localStorage` so
  in-progress work survives page refresh. The header shows a **Sign in**
  CTA; on save we redirect to `/login` if needed.

## Command palette

Press **⌘K** (or **Ctrl+K**) anywhere on the designer to open a fuzzy-search
palette built on shadcn's `Command`.

- **Add node** — search by node label or description (`task`, `approval`,
  `automated step`, etc.). Selecting drops a new node into the centre of
  the viewport.
- **Templates** — three ready-made graphs are surfaced: *Employee
  onboarding*, *Leave approval*, *Document verification*. Selecting one
  replaces the current canvas with the template (fresh ids each time) and
  fits the view.

The header also shows a `⌘K` button as a discoverability hint.

## Comments / annotations

Each node can carry a free-text **comment** for review notes:

- Edit it in the right-hand config panel under **Notes / comment**.
- Stored in a `Record<nodeId, string>` map alongside `nodes` and `edges`,
  serialized into the saved workflow's `graph.comments` and into the
  localStorage draft.
- A **badge** (💬 1) appears on the top-right of any commented node card on
  the canvas, with the comment text shown in a dashed footer strip on the
  card and as a tooltip on the badge.
- During simulation, every step in the timeline log shows its node's
  comment inline (when present), so reviewers see notes in context.
- Comments are also rendered in the PDF report below the relevant step.

## PDF export

Open the **Sandbox** panel and **Run simulation**. Once a result is
available, the **Export PDF report** button becomes active and produces a
client-side PDF (jsPDF) containing:

- Workflow name + run timestamp + overall success / failure pill.
- Validation issues (if any).
- The full step-by-step execution log: kind, title, status, duration, and
  the per-node comment underneath.

The **Download** icon in the sandbox header still exports the raw graph
(nodes + edges + comments) as JSON for sharing or version control.

## Completed vs. nice-to-have

**Completed**

- React Flow canvas, drag-from-sidebar, click-to-add, connect, select,
  delete (Backspace/Delete + panel button)
- 5 fully typed custom nodes with kind-specific accent + icon + comment badge
- Per-kind config forms (Start / Task / Approval / Automated / End) with
  KV editor, dynamic action params, role select, date input, switch — all
  Zod-validated, errors shown inline
- Real `/api/automations` + `/api/simulate` server routes (Zod-validated)
  replacing the previous client-only mock
- Sandbox panel: validation block, run, step-by-step timeline, per-step
  status + duration, inline comments
- JSON export of the graph + **PDF report** of the run
- Command palette (⌘K) for adding nodes and applying templates
- Per-node comments + on-canvas badge + simulation/PDF integration
- Auth (email/password + Google) and a per-user **workflow library**
  backed by Supabase RLS
- localStorage autosave for anonymous users
- MiniMap, Controls, dotted background, themed via design tokens
- Live header status (errors / warnings / valid)

**Would add with more time**

- JSON import paired with the existing export
- Undo/redo (history middleware around `setNodes` / `setEdges`)
- Per-node validation badges (alongside the comment badge)
- Auto-layout (Dagre/ELK) for imported graphs and templates
- Per-comment threads (multiple notes per node, author + timestamp)
- Edge function for the simulator so it can call out to real automation
  providers, not just echo the catalog
