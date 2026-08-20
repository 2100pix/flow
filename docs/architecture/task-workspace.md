# Flow — Task Workspace Architecture

## Status

This document is the canonical architecture for Milestone 15.

It supersedes the previous Board UX architecture where this document
defines newer behavior or task-domain semantics.

The approved Task List, Board, filter, Select, and Create Task Figma
designs are the visual source of truth.

---

# 1. Product Role

Task Workspace is the primary operational surface for project tasks.

Canonical route:

`/projects/:projectId/board`

The route is retained for compatibility even though the workspace supports
both List and Board views.

Task Workspace provides:

1. task browsing
2. task filtering
3. List view
4. Board view
5. task creation
6. task reordering
7. task status movement
8. inline task metadata editing
9. task detail opening

---

# 2. Project Boundary

Every Task belongs to exactly one Project.

Task access always inherits Project access.

Authorization chain:

Session
→ Workspace membership
→ task permission
→ Project visibility / ACL
→ Task

Inaccessible Private Project tasks remain non-discoverable.

---

# 3. Project Code

Resolved Project Code is:

custom override when present
otherwise automatic code derived from Project Name

Project Code rules:

- uppercase
- alphanumeric only
- minimum 1 character for an override
- maximum 4 characters

Automatic Project Code is also maximum 4 characters.

Example:

INVS

---

# 4. Task Number

Every Task receives a persistent positive integer scoped to its Project.

Storage field:

`task_number`

Examples:

1
2
3
4

Task Number:

- starts at 1 for a Project with no existing Tasks
- increments monotonically
- is unique inside one Project
- is never reused after Task archive
- does not depend on Task Status
- does not depend on sort order
- does not change when the Task moves

Database invariant:

UNIQUE(project_id, task_number)

---

# 5. Task Code

Visible Task Code is:

`<Resolved Project Code>-<Task Number>`

Examples:

INVS-1
INVS-2
FLOW-37

Task Code is read-only.

Task Code is not stored as an independent editable string.

Task Number is persistent.

Project Code is resolved from the current Project.

Changing Project Code therefore changes the visible Task Code prefix while
preserving the Task Number.

No zero-padding is used.

---

# 6. Task Core Model

Canonical Task fields:

id
projectId
taskNumber
taskCode
title
description
status
priority
assignees
startDate
dueDate
sortOrder
discordThreadUrl
createdAt
updatedAt

---

# 7. Status Model

Stable semantic status keys:

backlog
todo
in_progress
review
done
cancelled

Default presentation:

backlog → Backlog
todo → Ready
in_progress → Progress
review → In review
done → Complete
cancelled → Cancelled

Semantic keys remain backend identifiers.

Labels remain project-specific presentation.

---

# 8. Workflow Rules

Every Project owns exactly one workflow row for every supported semantic
Task Status.

Canonical status count:

6

Default order:

0 Backlog
1 Ready
2 Progress
3 In review
4 Complete
5 Cancelled

Backlog and Complete semantic keys remain required:

backlog
done

Intermediate status presentation may continue using the existing workflow
customization rules unless superseded by later product requirements.

Disabled statuses are not rendered as Task Workspace destinations.

---

# 9. Existing Workflow Migration

Existing workflow rows are preserved.

Existing custom labels must not be overwritten.

Only exact legacy default labels may be normalized:

To do
→ Ready

In progress
→ Progress

Review
→ In review

Done
→ Complete

Cancelled is inserted as the sixth status.

---

# 10. Priority

Canonical priority values:

null
urgent
low
medium
high

Presentation:

null → None
urgent → Urgent
low → Low priority
medium → Medium priority
high → High priority

Priority is editable from List, Create Task, and Task Detail when permitted.

---

# 11. Multiple Assignees

Tasks support zero or more Assignees.

Canonical storage:

task_assignees

task_id
user_id
created_at

Primary key:

(task_id, user_id)

Every Assignee must be a current Project Member.

Task response:

```ts
assignees: TaskAssigneeDto[]
```

The old single `assigneeId` field is not a long-term source of truth.

---

# 12. Start Date

Every persisted Task has a Start Date.

Storage:

start_date

Create Task may omit explicit Start Date.

When omitted:

Start Date = date on which the Task is created

Backend supplies a fallback for non-UI callers.

Start Date may later be changed.

Start Date cannot be cleared to null.

---

# 13. Due Date

Due Date is optional.

Storage:

due_date

Valid:

null
or ISO date

When Due Date exists:

dueDate >= startDate

Invalid date range must be rejected by the backend.

---

# 14. Task Description

Task Description is optional.

It is not rendered in List rows or Board cards.

Description belongs to Create Task and Task Detail.

---

# 15. Task Workspace URL State

Canonical query parameters:

view
status
task

View:

list
board

Default:

list

Example:

`/projects/:projectId/board?view=list`

Status filter:

`status=<semantic-status-key>`

Example:

`?view=list&status=backlog`

Task Detail:

`task=<taskId>`

Example:

`?view=board&task=tsk_xxx`

---

# 16. Filter Bar

Canonical visible filter controls:

All project
first enabled workflow status
second enabled workflow status
More

Figma default example:

All project
Backlog
Ready
...

The two explicit status chips are determined by enabled workflow position.

Remaining enabled statuses live in the `...` menu.

All project clears the status filter.

---

# 17. Filter Semantics

No status filter:

List
→ render all enabled status sections

Board
→ render all enabled status columns

Selected status:

List
→ render only the selected status section

Board
→ render only the selected status column

Filtering does not mutate Tasks.

---

# 18. View Switcher

Task Workspace provides:

List
Board

The selected view is represented in URL state.

Changing view preserves the selected status filter.

Task Detail search state is preserved when valid.

---

# 19. List View

List View groups Tasks by enabled workflow status.

Each status section contains Task rows ordered by `sortOrder`.

Task row left side:

Task Code
Task Title

Task row right side:

Status
Priority
Due Date
Assignees

Task Code and Task Title are read-only from the list row.

Task Title editing remains in Task Detail.

---

# 20. List Inline Editing

The following List metadata controls are editable when authorized:

Status
Priority
Due Date
Assignees

Default controls are visually quiet.

Hover, focus, and open states use a subtle muted pill/background treatment.

Interaction with metadata controls must not open Task Detail.

---

# 21. List Drag and Drop

List rows support Task reordering.

Same-status movement:

reorder inside one status

Cross-status movement:

change status

- reorder

The existing complete-affected-column persistence contract is retained.

Same status:

send 1 column

Cross status:

send 2 columns

---

# 22. Board View

Board View renders enabled workflow statuses as horizontal columns.

Column width follows the approved Figma design.

Columns remain fixed-width and do not stretch based on Task count.

Each column contains:

Status label
Task count
Task cards
New task item interaction

---

# 23. Board Task Card

Board card displays:

Task Code
Assignees
Task Title
Due Date
Priority

Description is not rendered.

Status is represented by the containing column.

Project identity and Task Code are not editable from the card.

---

# 24. Board Drag and Drop

Board uses the same ordering model as List.

Task movement is optimistic.

Failure restores canonical server state.

Drag persistence uses the existing reorder endpoint contract.

Disabled statuses are not drop targets.

---

# 25. Horizontal Board Pan

Board retains native horizontal scrolling.

Desktop pointer dragging also pans the board horizontally.

Pointer pan may begin from:

board background
column empty area

Pointer pan must not begin from:

Task Card
Button
Link
Select
Popover
Date picker
Task drag handle
other interactive controls

Task DnD and Board pan must not compete for the same pointer gesture.

---

# 26. New Task Item

When the user can create Tasks, each Board column exposes:

New task item

The interaction is visually quiet when idle.

It becomes visible on hover/focus of the relevant column area.

Activating it opens the canonical Create Task Dialog with that column's
semantic status preselected.

The old inline quick-create composer is superseded by this behavior.

---

# 27. Create Task Dialog

Desktop target:

603 × 473

Viewport constraints remain responsive.

Visual structure:

Create a new task

Task name

Description

Status
Priority
Assignees
Start Date
Due Date

Cancel
Create task

Task Name and Description use the same lightweight borderless visual
language as Create Project.

---

# 28. Create Task Metadata Row

Metadata controls use:

display flex
flex-wrap

Horizontal gap:

16px

Vertical wrap gap:

10px

Controls use compact shadcn / Base UI surfaces and Phosphor icons.

When a date is selected, its control label changes from the generic field
label to the selected formatted date.

The control may grow horizontally.

Wrapping handles insufficient row width.

---

# 29. Create Task Defaults

Task Name:

empty

Description:

empty

Status:

Backlog semantic key

Priority:

None

Assignees:

none

Start Date:

creation date when submitted if not manually selected

Due Date:

unset

---

# 30. Create Task Request

Canonical Create Task input:

```ts
{
  title: string,
  description?: string,
  status?: TaskStatus,
  priority?: TaskPriority | null,
  assigneeIds?: string[],
  startDate?: string,
  dueDate?: string | null
}
```

Backend validates all supplied fields.

---

# 31. Create Task Atomicity

Creating a Task is one logical operation:

authorize
→ load Project
→ validate workflow
→ validate Assignees
→ validate dates
→ allocate Task Number
→ create Task
→ create Task Assignee relations
→ return enriched Task DTO

A partial Task/Assignee creation state is invalid.

---

# 32. Create Success

Successful creation:

invalidate Project Tasks
→ reset Create Task state
→ close Dialog
→ toast

Toast:

`Task created.`

The user remains in the current List/Board workspace.

---

# 33. Status Select

Status Select uses enabled workflow statuses.

It uses the approved shadcn Select treatment.

Default semantic icon mapping must use installed Phosphor icons.

Selected state uses a visible check.

No custom popup infrastructure is required.

---

# 34. Priority Select

Priority Select contains:

None
Urgent
Low priority
Medium priority
High priority

Selected state uses a visible check.

Icons use installed Phosphor icons.

---

# 35. Assignee Picker

Assignee Picker uses Project Members only.

Interaction follows the established Project Member picker language.

Multiple selection is supported.

Selected users are shown as a compact Avatar Group where appropriate.

No Workspace Member outside the Project may become a Task Assignee.

---

# 36. Date Pickers

Start Date and Due Date use the existing shadcn Calendar + Popover primitives.

Native `<input type="date">` is not used by the new Create Task experience.

---

# 37. Task Detail

Existing URL-addressable Task Detail behavior remains:

`?task=<taskId>`

Task Detail must be made compatible with:

Task Code
multiple Assignees
Start Date
six-status workflow

A separate speculative visual redesign is not part of this milestone unless
an approved Task Detail design becomes available.

---

# 38. Permissions

Read:

tasks.view

Create:

tasks.create

Edit title/description/status/priority/dates:

tasks.edit

Assign:

tasks.assign

Reorder:

tasks.edit

Archive:

tasks.archive

Frontend checks control presentation.

Backend authorization remains authoritative.

---

# 39. Dashboard Compatibility

Cancelled Tasks are not Open Tasks.

Cancelled Tasks are not My Tasks in active-work calculations.

Cancelled Tasks are not Completed Tasks.

Project progress calculation excludes Cancelled Tasks from the denominator.

Multiple Assignee membership must replace direct use of legacy
`tasks.assignee_id` in My Tasks queries.

---

# 40. Migration Requirements

Milestone 15 requires a local migration.

The migration must:

1. preserve every existing Task
2. assign deterministic Task Numbers per Project
3. backfill Start Date from Task creation date
4. preserve legacy single Assignees into `task_assignees`
5. add Cancelled to Task status constraints
6. preserve existing workflow customization
7. insert Cancelled workflow rows
8. normalize only exact legacy default labels
9. preserve Task sort ordering
10. preserve foreign-key integrity

No remote migration is applied until separately authorized.

---

# 41. Final Invariants

Every Task belongs to one Project.

Every Task has a positive project-scoped Task Number.

Task Number is unique inside the Project.

Task Code is read-only and derived from Project Code + Task Number.

Project Code is maximum 4 characters.

Every Task has Start Date.

Due Date cannot precede Start Date.

Every Assignee is a Project Member.

Tasks may have zero or more Assignees.

Task workflow uses six stable semantic statuses.

List and Board share one Task ordering model.

Filtering never changes Task persistence.

Disabled statuses are never drop destinations.

Backend authorization remains authoritative.
