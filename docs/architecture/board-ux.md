# Board UX Architecture

## Purpose

The project board is the primary operational surface for project tasks.

Board UX must optimize for:

- fast task scanning,
- predictable status movement,
- low-friction task creation,
- stable interaction under mutation,
- clear permission boundaries,
- usable behavior with large task counts.

This milestone changes presentation and interaction behavior only.

It does not change task semantics, workflow semantics, project ACL, or storage.

---

## Source of Truth

The board must remain driven by project task workflow.

Enabled project workflow statuses determine:

- which columns exist,
- column order,
- column labels,
- task status destinations.

Semantic task status keys remain stable:

- backlog
- todo
- in_progress
- review
- done

The board must never derive semantic meaning from a custom label.

Disabled statuses are not rendered as board columns.

---

## Board Viewport

The board lives inside the authenticated application shell.

The global application header occupies 3rem of viewport height.

The board therefore must use the remaining application viewport:

100vh - 3rem
The board itself must not create an additional document-level vertical scroll.

Layout:

Application header
──────────────────────────────
Board header
──────────────────────────────
Horizontal board viewport
├─ Column
├─ Column
├─ Column
└─ ...

Horizontal overflow belongs to the board viewport.

Vertical overflow belongs to each individual task column.

---

## Columns

Each enabled workflow status renders exactly one column.

Column order follows workflow position.

Columns use a stable desktop-oriented width.

Columns must not stretch based on task count.

Recommended width:

288–300px

Each column consists of:

Column header
Task scroll area
Quick-create footer

Column header and quick-create footer remain visible while the task list scrolls.

The task list owns vertical scrolling.

---

## Column Header

Column header displays:

project-specific workflow label,
active task count.

The semantic status key is not displayed on the board.

Status keys are implementation identifiers, not user-facing labels.

---

## Empty Columns

An empty enabled column remains visible.

Empty state must be quiet and compact.

Example:

No tasks

If the user can create tasks, quick-create remains available.

Empty columns must remain valid drop targets.

---

## Task Cards

A task card prioritizes scanability.

Primary information:

title
priority
due date
assignee

Description is not rendered on the board card.

Detailed task information remains in Task Detail.

Task title may occupy at most a small bounded number of lines before truncation.

Cards must not change height dramatically because of long content.

---

## Card Interaction

The task body opens Task Detail.

Dragging uses a dedicated drag handle.

Opening a task and initiating drag must remain separate interactions.

The drag handle must:

have an accessible label,
visually indicate grab capability,
disappear or become disabled when task editing is unavailable.

The whole card must not become a drag handle.

This prevents accidental drag operations when opening a task.

---

## Task Detail

Task Detail remains URL-addressable through:

?task=<taskId>

Opening Task Detail must not navigate away from the board.

Closing Task Detail removes only the task search parameter.

Workflow labels and enabled destinations remain sourced from the project workflow.

Opening and closing Task Detail must not reset board data.

---

## Quick Create

Quick create is per-column.

The default state is collapsed.

Example:

- Add task

Activating quick create opens a compact composer.

Composer behavior:

Enter
→ create task

Escape
→ cancel composer

successful create
→ clear input
→ close composer

failed create
→ keep input
→ show local error

The created task inherits the column semantic status.

Quick create is hidden when the user lacks:

tasks.create

---

## Drag and Drop

Task movement remains optimistic.

Dragging is available only with:

tasks.edit

Drag is disabled while reorder persistence is pending.

Valid movement:

same column
→ reorder

different enabled column
→ status change + reorder

Disabled workflow statuses can never be drag destinations because they are not rendered.

---

## Drag Feedback

During drag:

source card visibly changes state,
active drop column is visibly indicated,
pointer retains grab/grabbing semantics.

Feedback must remain subtle.

The board must not use large overlays or modal drag previews.

---

## Reorder Persistence

The backend remains authoritative.

Client sends complete affected columns.

Same-column reorder sends one column.

Cross-column movement sends source and destination columns.

On success:

optimistic board
→ server state confirmed

On failure:

optimistic board discarded
→ canonical server state restored
→ visible board error

A failed reorder must never leave the UI showing a task position that was not persisted.

---

## Mutation Locking

While a reorder request is pending:

new drag operations are disabled,
task cards remain openable,
task creation may remain available.

Only the interaction that risks conflicting reorder state is locked.

---

## Permissions

Board read:

tasks.view

- project access

Quick create:

tasks.create

- project access

Drag/reorder:

tasks.edit

- project access

Task Detail continues enforcing its own edit and assignment permissions.

Frontend permission checks are presentation controls only.

Backend authorization remains authoritative.

---

## Private Projects

Board UX must not alter private-project non-discoverability.

An inaccessible private project continues to behave as not found.

Board components must not attempt to infer whether failure came from:

project absence,
private-project ACL.

---

## Board Header

Board header contains only project-context information.

Required:

back navigation to project overview,
project name,
client name.

Useful compact secondary information may include:

total active task count,
project visibility indicator.

The board header must remain smaller than the task workspace.

Board operations must not be dominated by project metadata.

---

## Loading

Project, tasks, and workflow are required before rendering the operational board.

Loading behavior must avoid rendering incorrect hardcoded columns.

Board loading therefore waits for:

project
tasks
workflow

---

## Error States

Board-level loading failure renders a board-level error.

Column-local task creation failure renders near the composer.

Reorder failure renders near the board header.

Task Detail failure remains inside Task Detail.

Errors should remain scoped to the interaction that failed.

---

## Scrolling

Board scrolling model:

Document
→ no board-induced vertical overflow

Board viewport
→ horizontal scroll

Column task body
→ vertical scroll

Each column scroll position is independent.

Scrolling a long column must not move another column vertically.

---

## Responsive Behavior

The board remains a horizontal kanban surface.

Columns do not stack vertically on narrow screens.

Small viewports use horizontal board scrolling.

Column width remains usable for task scanning.

---

## Performance

The board must not perform per-card network requests.

Project tasks are fetched once per project board query.

Workflow is fetched once per project workflow query.

Task cards render from cached board data.

Board derivation may use memoization.

Stable task IDs remain React keys.

---

## Accessibility

Interactive controls require meaningful accessible labels.

Required keyboard-accessible actions include:

open task,
quick-create activation,
quick-create submission,
quick-create cancellation,
Task Detail close.

Drag handle must expose an accessible task-specific label.

Board UX must not depend on hover alone to expose essential functionality.

---

## Failure Policy

The board must fail closed when workflow integrity fails.

It must not synthesize workflow columns locally.

If workflow cannot be loaded or is invalid:

board unavailable

not:

hardcoded fallback workflow

---

## Non-Goals

This milestone does not introduce:

custom status keys,
board filters,
board search,
swimlanes,
grouping,
WIP limits,
bulk task editing,
saved board views,
task dependencies,
task automations,
status transition rules,
per-user board layouts,
arbitrary card customization.

Those require separate architecture decisions.

---

## Implementation Sequence

8.9B — Board Viewport + Column Scrolling

Fix application-shell height ownership and give every column an independent task scroll region.

8.9C — Task Cards + Quick Create

Improve card hierarchy, replace permanent composer with collapsed quick-create interaction, and replace text drag affordance.

8.9D — Drag/Drop Feedback + Recovery

Harden optimistic drag state, mutation feedback, rollback behavior, and drop-target presentation.

8.9E — Board Header + States Polish

Polish board context, counts, empty states, loading states, and board-scoped errors.

8.9F — Runtime Board UX Matrix

Validate long columns, empty columns, permissions, task creation, same-column reorder, cross-column movement, mutation failure, custom workflow labels/order, disabled statuses, and private-project ACL.
